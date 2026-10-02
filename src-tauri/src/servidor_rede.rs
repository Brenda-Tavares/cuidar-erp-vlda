use std::sync::{Arc, Mutex};

use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::AppHandle;
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

#[derive(Clone, Serialize, Deserialize)]
pub struct RedeLocalConfig {
    pub habilitada: bool,
    pub porta: u16,
    pub ip: String,
}

lazy_static! {
    static ref SERVIDOR: Mutex<Option<Arc<Server>>> = Mutex::new(None);
}

fn e_ipv4_privada(ip: &std::net::Ipv4Addr) -> bool {
    let o = ip.octets();
    o[0] == 10 || (o[0] == 172 && (16..=31).contains(&o[1])) || (o[0] == 192 && o[1] == 168)
}

pub fn listar_ips_locais() -> Vec<String> {
    let mut ips: Vec<String> = Vec::new();

    if let Ok(ip) = local_ip_address::local_ip() {
        if let std::net::IpAddr::V4(ip4) = ip {
            if e_ipv4_privada(&ip4) {
                ips.push(ip4.to_string());
            }
        }
    }

    if let Ok(interfaces) = local_ip_address::list_afinet_netifas() {
        for (nome, ip) in interfaces {
            let nome = nome.to_lowercase();
            let nome_virtual = [
                "virtual", "vbox", "vmware", "wsl", "hyper-v", "vethernet", "bluetooth",
            ];
            if nome_virtual.iter().any(|x| nome.contains(x)) {
                continue;
            }
            if let std::net::IpAddr::V4(ip4) = ip {
                if e_ipv4_privada(&ip4) {
                    let s = ip4.to_string();
                    if !ips.contains(&s) {
                        ips.push(s);
                    }
                }
            }
        }
    }

    ips
}

pub fn get_ip_local() -> Result<String, String> {
    listar_ips_locais()
        .first()
        .cloned()
        .ok_or_else(|| "Nenhum IP local encontrado".to_string())
}

pub fn config(app: &AppHandle) -> RedeLocalConfig {
    let conn = crate::get_db_connection(app);
    if let Ok(conn) = conn {
        let result = conn.query_row(
            "SELECT valor FROM configuracoes WHERE chave = 'rede_local'",
            [],
            |r| r.get::<_, String>(0),
        );
        if let Ok(valor) = result {
            if let Ok(cfg) = serde_json::from_str::<RedeLocalConfig>(&valor) {
                return cfg;
            }
        }
    }
    RedeLocalConfig {
        habilitada: false,
        porta: 1420,
        ip: String::new(),
    }
}

pub fn set_config(app: &AppHandle, cfg: &RedeLocalConfig) -> Result<(), String> {
    let conn = crate::get_db_connection(app).map_err(|e| e.to_string())?;
    let valor = serde_json::to_string(cfg).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('rede_local', ?1)",
        rusqlite::params![valor],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn parar() {
    if let Some(s) = SERVIDOR.lock().unwrap().take() {
        s.unblock();
    }
}

pub fn iniciar(app: &AppHandle) {
    let cfg = config(app);
    if !cfg.habilitada {
        return;
    }
    let ips = listar_ips_locais();
    let ip = if cfg.ip.is_empty() || !ips.contains(&cfg.ip) {
        ips.first().cloned().unwrap_or_else(|| "127.0.0.1".to_string())
    } else {
        cfg.ip.clone()
    };
    let endereco = format!("{}:{}", ip, cfg.porta);
    match Server::http(&endereco) {
        Ok(server) => {
            let server = Arc::new(server);
            *SERVIDOR.lock().unwrap() = Some(server.clone());
            let app2 = app.clone();
            std::thread::spawn(move || {
                loop_de_requisicoes(server, app2);
            });
            log::info!(
                target: "rede",
                "[REDE] Servidor iniciado em http://{}",
                endereco
            );
        }
        Err(e) => {
            log::error!(target: "rede", "[REDE] Falha ao iniciar servidor em {}: {}", endereco, e);
        }
    }
}

pub fn reiniciar(app: &AppHandle) -> Result<(), String> {
    parar();
    let cfg = config(app);
    if cfg.habilitada {
        iniciar(app);
    }
    let ips = listar_ips_locais();
    let ip = if cfg.ip.is_empty() || !ips.contains(&cfg.ip) {
        ips.first().cloned().unwrap_or_else(|| "127.0.0.1".to_string())
    } else {
        cfg.ip.clone()
    };
    if cfg.habilitada && SERVIDOR.lock().unwrap().is_none() {
        return Err(format!(
            "Não foi possível iniciar o servidor em {}:{}. Verifique se a porta está em uso ou libere no firewall.",
            ip, cfg.porta
        ));
    }
    Ok(())
}

fn loop_de_requisicoes(server: Arc<Server>, app: AppHandle) {
    for request in server.incoming_requests() {
        let url = request.url().to_string();
        let method = request.method().clone();
        if url == "/rpc" && method == Method::Post {
            lidar_rpc(&app, request);
        } else if url == "/upload" && method == Method::Post {
            lidar_upload(&app, request);
        } else {
            lidar_asset(&app, request, &url);
        }
    }
}

fn token_do_header(request: &Request) -> Option<String> {
    request
        .headers()
        .iter()
        .find(|h| h.field.as_str().as_str().eq_ignore_ascii_case("authorization"))
        .and_then(|h| h.value.as_str().strip_prefix("Bearer "))
        .map(|s| s.to_string())
}

fn header_content_type(extra: &str) -> Header {
    Header::from_bytes(
        b"Content-Type",
        format!("application/json; charset=utf-8{}", extra).as_bytes(),
    )
    .unwrap()
}

fn lidar_rpc(app: &AppHandle, mut request: Request) {
    let mut corpo = Vec::new();
    let _ = request.as_reader().read_to_end(&mut corpo);
    let parsed: Value = serde_json::from_slice(&corpo).unwrap_or(Value::Null);
    let comando = parsed
        .get("comando")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let args = parsed.get("argumentos").cloned().unwrap_or(Value::Null);
    let token = token_do_header(&request);

    let resultado = crate::rpc::handle_rpc(app, &comando, args, token.as_deref());

    let (status, resposta) = match resultado {
        Ok(dados) => (StatusCode(200), json!({"ok": true, "dados": dados})),
        Err(erro) => (StatusCode(400), json!({"ok": false, "erro": erro})),
    };
    let _ = request.respond(
        Response::from_string(resposta.to_string())
            .with_status_code(status)
            .with_header(header_content_type("")),
    );
}

fn lidar_upload(_app: &AppHandle, mut request: Request) {
    let token = token_do_header(&request);
    if crate::rpc::validar_token(&token.unwrap_or_default()).is_none() {
        let _ = request.respond(
            Response::from_string(json!({"ok": false, "erro": "Não autenticado"}).to_string())
                .with_status_code(StatusCode(401))
                .with_header(header_content_type("")),
        );
        return;
    }

    let boundary: Option<String> = request
        .headers()
        .iter()
        .find(|h| h.field.as_str().as_str().eq_ignore_ascii_case("content-type"))
        .and_then(|h| {
            h.value.as_str()
                .split(';')
                .map(|p| p.trim())
                .find(|p| p.starts_with("boundary="))
                .map(|p| p.trim_start_matches("boundary=").trim_matches('"').to_string())
        });

    let mut corpo = Vec::new();
    let _ = request.as_reader().read_to_end(&mut corpo);

    let mut resposta = json!({"ok": false, "erro": "Nenhum arquivo recebido"});
    let mut status = StatusCode(400);

    if let Some(boundary) = boundary {
        if let Some((nome, bytes)) = extrair_multipart(&corpo, &boundary) {
            let nome_limpo = nome.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let dir = std::env::temp_dir().join("cuidar-erp-uploads");
            let _ = std::fs::create_dir_all(&dir);
            let caminho = dir.join(format!("{}-{}", ts, nome_limpo));
            match std::fs::write(&caminho, &bytes) {
                Ok(_) => {
                    resposta = json!({"ok": true, "caminho": caminho.to_string_lossy()});
                    status = StatusCode(200);
                    log::info!(target: "rede", "[REDE] Upload recebido: {}", caminho.display());
                }
                Err(e) => {
                    resposta = json!({"ok": false, "erro": format!("Erro ao salvar upload: {}", e)});
                }
            }
        }
    }

    let _ = request.respond(
        Response::from_string(resposta.to_string())
            .with_status_code(status)
            .with_header(header_content_type("")),
    );
}

fn encontrar_bytes(hay: &[u8], agulha: &[u8]) -> Option<usize> {
    hay.windows(agulha.len()).position(|w| w == agulha)
}

fn extrair_multipart(corpo: &[u8], boundary: &str) -> Option<(String, Vec<u8>)> {
    let delim = format!("--{}", boundary);
    let delim_bytes = delim.as_bytes();
    let mut pos = 0usize;
    while let Some(inicio) = encontrar_bytes(&corpo[pos..], delim_bytes) {
        let part_inicio = pos + inicio + delim_bytes.len();
        if corpo.get(part_inicio..part_inicio + 2) == Some(&b"--"[..]) {
            break;
        }
        let resto = &corpo[part_inicio..];
        if let Some(fim) = encontrar_bytes(resto, delim_bytes) {
            let part = &resto[..fim];
            if let Some(sep) = encontrar_bytes(part, b"\r\n\r\n") {
                let cabecalho = &part[..sep];
                let dados = &part[sep + 4..];
                let nome = extrair_filename(cabecalho)?;
                let dados = dados.strip_suffix(b"\r\n").unwrap_or(dados).to_vec();
                return Some((nome, dados));
            }
        }
        pos = part_inicio;
    }
    None
}

fn extrair_filename(cabecalho: &[u8]) -> Option<String> {
    let texto = String::from_utf8_lossy(cabecalho);
    let idx = texto.find("filename=")?;
    let resto = &texto[idx + 9..];
    let fim = resto.find(['"', ';']).unwrap_or(resto.len());
    let nome = &resto[..fim];
    if nome.is_empty() {
        None
    } else {
        Some(nome.to_string())
    }
}

fn mime_por_extensao(rel: &str) -> &'static str {
    let ext = rel.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    match ext.as_str() {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "webp" => "image/webp",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "eot" => "application/vnd.ms-fontobject",
        "txt" => "text/plain; charset=utf-8",
        "map" => "application/json",
        _ => "application/octet-stream",
    }
}

fn servir_asset(app: &AppHandle, rel: &str) -> Option<(Vec<u8>, String)> {
    if let Some(asset) = app.asset_resolver().get(rel.to_string()) {
        let mime = if asset.mime_type.is_empty() {
            mime_por_extensao(rel).to_string()
        } else {
            asset.mime_type
        };
        return Some((asset.bytes.to_vec(), mime));
    }
    let base = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../out");
    let caminho = base.join(rel);
    if caminho.is_file() {
        if let Ok(bytes) = std::fs::read(&caminho) {
            return Some((bytes, mime_por_extensao(rel).to_string()));
        }
    }
    None
}

fn lidar_asset(app: &AppHandle, request: Request, url: &str) {
    let caminho = url.split(['?', '#']).next().unwrap_or("/");
    let caminho = if caminho == "/" { "/index.html" } else { caminho };
    let rel = caminho.trim_start_matches('/');

    if let Some((bytes, mime)) = servir_asset(app, rel) {
        let _ = request.respond(
            Response::from_data(bytes)
                .with_header(Header::from_bytes(b"Content-Type", mime.as_bytes()).unwrap()),
        );
        return;
    }

    let ultima_parte = rel.rsplit('/').next().unwrap_or("");
    let tem_extensao = ultima_parte.contains('.');
    if !tem_extensao {
        if let Some((bytes, mime)) = servir_asset(app, "index.html") {
            let _ = request.respond(
                Response::from_data(bytes)
                    .with_header(Header::from_bytes(b"Content-Type", mime.as_bytes()).unwrap()),
            );
            return;
        }
    }

    let _ = request.respond(
        Response::from_string("Nao encontrado").with_status_code(StatusCode(404)),
    );
}