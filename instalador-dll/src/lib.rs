use base64::Engine;
use chrono::NaiveDate;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};

static PUBLIC_KEY_BYTES: &[u8] = include_bytes!("../dev_public_key.bin");

#[link(name = "msi")]
extern "system" {
    fn MsiGetPropertyW(
        hInstall: u32,
        szName: *const u16,
        szValue: *mut u16,
        pcchValue: *mut u32,
    ) -> u32;
    fn MsiSetPropertyW(hInstall: u32, szName: *const u16, szValue: *const u16) -> u32;
}

fn validar_chave(chave: &str) -> Result<(), String> {
    let parts: Vec<&str> = chave.split(':').collect();
    if parts.len() < 3 {
        return Err("Formato invalido. Use: validade:nome:assinatura".into());
    }

    let validade_str = parts[0];
    let nome = parts[1];
    let assinatura_b64 = parts[2];

    let validade =
        NaiveDate::parse_from_str(validade_str, "%Y-%m-%d").map_err(|_| "Data de validade invalida".to_string())?;

    let dados = format!("validade={}|nome={}", validade.format("%Y-%m-%d"), nome);

    let pub_key_array: [u8; 32] = PUBLIC_KEY_BYTES
        .try_into()
        .map_err(|_| "Chave publica invalida (tamanho incorreto)".to_string())?;
    let verifying_key = VerifyingKey::from_bytes(&pub_key_array)
        .map_err(|e| format!("Erro ao carregar chave publica: {}", e))?;

    let assinatura_bytes = base64::engine::general_purpose::URL_SAFE
        .decode(assinatura_b64)
        .map_err(|_| "Assinatura em Base64 invalida".to_string())?;

    let sig = Signature::from_slice(&assinatura_bytes)
        .map_err(|e| format!("Erro ao interpretar assinatura: {}", e))?;

    verifying_key
        .verify(dados.as_bytes(), &sig)
        .map_err(|_| "Assinatura invalida".to_string())?;

    let hoje = chrono::Local::now().naive_local().date();
    if validade < hoje {
        return Err(format!("Licenca expirada em {}", validade.format("%d/%m/%Y")));
    }

    Ok(())
}

fn get_user_key(h_msi: u32) -> Option<String> {
    let prop_name: Vec<u16> = "LICENSEKEY\0".encode_utf16().collect();

    let mut buf: Vec<u16> = vec![0u16; 512];
    let mut len = buf.len() as u32;
    let ret = unsafe { MsiGetPropertyW(h_msi, prop_name.as_ptr(), buf.as_mut_ptr(), &mut len) };
    if ret != 0 {
        return None;
    }
    if len == 0 {
        return None;
    }

    let key_utf16: Vec<u16> = buf.into_iter().take_while(|&c| c != 0).collect();
    Some(String::from_utf16_lossy(&key_utf16))
}

#[no_mangle]
pub extern "system" fn ValidateLicense(h_msi: u32) -> u32 {
    let valid = match get_user_key(h_msi) {
        Some(k) => validar_chave(k.trim()).is_ok(),
        None => false,
    };
    set_license_valid(h_msi, valid);
    0
}

fn set_license_valid(h_msi: u32, valid: bool) {
    let prop: Vec<u16> = "LICENSEVALID\0".encode_utf16().collect();
    let val: Vec<u16> = if valid {
        "1\0".encode_utf16().collect()
    } else {
        "0\0".encode_utf16().collect()
    };
    unsafe {
        MsiSetPropertyW(h_msi, prop.as_ptr(), val.as_ptr());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::Signer;

    const CHAVE_CLIENTE: &str = "2031-09-03:V1l4@do#Apr3nd3r:d1hgAmsI7JJvZHGuTX62KbaYW1xV5C5H-xvMpeyUQ7dhBUcM-X-c9q0CYWCWjYPcWuxcdjNAPj_N_J8zWwdyBQ==";

    fn chave_assinada(validade: &str, nome: &str) -> String {
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
        let priv_key_path = std::path::Path::new(&manifest_dir).join("../src-tauri/dev_private_key.bin");
        let priv_key_bytes = std::fs::read(&priv_key_path).unwrap();
        let priv_key_array: [u8; 32] = priv_key_bytes[..32].try_into().unwrap();
        let signing_key = ed25519_dalek::SigningKey::from_bytes(&priv_key_array);

        let dados = format!("validade={}|nome={}", validade, nome);
        let assinatura = signing_key.sign(dados.as_bytes());
        let assinatura_b64 = base64::engine::general_purpose::URL_SAFE.encode(assinatura.to_bytes());

        format!("{}:{}:{}", validade, nome, assinatura_b64)
    }

    #[test]
    fn chave_do_cliente_e_valida() {
        assert!(validar_chave(CHAVE_CLIENTE).is_ok(), "A chave do cliente deve ser valida");
    }

    #[test]
    fn chave_assinada_corretamente_e_valida() {
        let chave = chave_assinada("2099-12-31", "Teste");
        assert!(validar_chave(&chave).is_ok(), "Chave assinatura deve ser valida: {:?}", validar_chave(&chave).err());
    }

    #[test]
    fn chave_expirada_invalida() {
        let chave = chave_assinada("2020-01-01", "Teste");
        let err = validar_chave(&chave).unwrap_err();
        assert!(err.contains("expirada"), "Esperava erro de expiracao, obteve: {}", err);
    }

    #[test]
    fn assinatura_adulterada_invalida() {
        let parts: Vec<&str> = CHAVE_CLIENTE.split(':').collect();
        let chave = format!(
            "{}:{}:ADULTERADA_INVALIDA_THIS_WILL_FAIL_BASE64_DECODE_AND_VERIFY",
            parts[0], parts[1]
        );
        assert!(validar_chave(&chave).is_err(), "Assinatura adulterada deve falhar");
    }

    #[test]
    fn formato_invalido_falha() {
        assert!(validar_chave("chave-sem-formato").is_err());
        assert!(validar_chave("").is_err());
        assert!(validar_chave("so:duas").is_err());
    }
}
