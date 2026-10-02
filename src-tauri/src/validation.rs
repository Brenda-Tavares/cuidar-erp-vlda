use regex::Regex;
use lazy_static::lazy_static;

lazy_static! {
    static ref EMAIL_REGEX: Regex = Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").unwrap();
    static ref PHONE_REGEX: Regex = Regex::new(r"^\(\d{2}\)\s?\d{4,5}-?\d{4}$").unwrap();
}

pub fn validar_cpf(cpf: &str) -> Result<(), String> {
    let cpf_limpo: String = cpf.chars().filter(|c| c.is_ascii_digit()).collect();

    if cpf_limpo.len() != 11 {
        return Err("CPF deve ter 11 dígitos".to_string());
    }

    let cpfs_invalidos = [
        "00000000000", "11111111111", "22222222222", "33333333333",
        "44444444444", "55555555555", "66666666666", "77777777777",
        "88888888888", "99999999999", "12345678909",
    ];

    if cpfs_invalidos.contains(&cpf_limpo.as_str()) {
        return Err("CPF inválido".to_string());
    }

    let calcular_digito = |cpf: &str, peso_inicial: usize| -> u32 {
        let soma: u32 = cpf.chars()
            .take(peso_inicial - 1)
            .enumerate()
            .map(|(i, c)| c.to_digit(10).unwrap() * (peso_inicial - i) as u32)
            .sum();
        let resto = soma % 11;
        if resto < 2 { 0 } else { 11 - resto }
    };

    let digito1 = calcular_digito(&cpf_limpo, 10);
    let digito2 = calcular_digito(&cpf_limpo, 11);

    let digitos_calculados = format!("{}{}", digito1, digito2);
    let digitos_informados = &cpf_limpo[9..11];

    if digitos_calculados != digitos_informados {
        return Err("CPF inválido (dígitos verificadores incorretos)".to_string());
    }

    Ok(())
}

pub fn validar_email(email: &str) -> Result<(), String> {
    if email.is_empty() {
        return Err("E-mail não pode estar vazio".to_string());
    }

    if email.len() > 255 {
        return Err("E-mail muito longo (máx 255 caracteres)".to_string());
    }

    if !EMAIL_REGEX.is_match(email) {
        return Err("Formato de e-mail inválido".to_string());
    }

    Ok(())
}

pub fn validar_telefone(telefone: &str) -> Result<(), String> {
    if telefone.is_empty() {
        return Ok(());
    }

    if !PHONE_REGEX.is_match(telefone) {
        return Err("Formato de telefone inválido. Use: (XX) XXXXX-XXXX".to_string());
    }

    let digitos: String = telefone.chars().filter(|c| c.is_ascii_digit()).collect();
    if digitos.len() == 11 && digitos.chars().nth(2) != Some('9') {
        return Err("Telefone celular deve começar com 9 após o DDD, ex: (48) 99999-9999".to_string());
    }

    Ok(())
}

pub fn validar_nome(nome: &str, campo: &str) -> Result<(), String> {
    if nome.trim().is_empty() {
        return Err(format!("{} não pode estar vazio", campo));
    }

    if nome.trim().len() < 2 {
        return Err(format!("{} deve ter pelo menos 2 caracteres", campo));
    }

    if nome.len() > 100 {
        return Err(format!("{} muito longo (máx 100 caracteres)", campo));
    }

    Ok(())
}

pub fn validar_nome_completo(nome: &str, campo: &str) -> Result<(), String> {
    validar_nome(nome, campo)?;

    if nome.split_whitespace().count() < 2 {
        return Err(format!("{} deve conter nome e sobrenome", campo));
    }

    Ok(())
}

pub fn validar_valor_positivo(valor: f64, campo: &str) -> Result<(), String> {
    if valor <= 0.0 {
        return Err(format!("{} deve ser maior que zero", campo));
    }

    if valor > 999999999.99 {
        return Err(format!("{} muito alto (máx R$ 999.999.999,99)", campo));
    }

    Ok(())
}

#[allow(dead_code)]
pub fn validar_valor_nao_negativo(valor: f64, campo: &str) -> Result<(), String> {
    if valor < 0.0 {
        return Err(format!("{} não pode ser negativo", campo));
    }

    Ok(())
}

pub fn validar_data(data: &str, campo: &str, permitir_futura: bool) -> Result<(), String> {
    use chrono::NaiveDate;

    let data_parseada = NaiveDate::parse_from_str(data, "%Y-%m-%d")
        .map_err(|_| format!("{} inválida. Use formato YYYY-MM-DD", campo))?;

    let hoje = chrono::Local::now().date_naive();

    if !permitir_futura && data_parseada > hoje {
        return Err(format!("{} não pode ser uma data futura", campo));
    }

    let data_minima = NaiveDate::from_ymd_opt(1900, 1, 1).unwrap();
    if data_parseada < data_minima {
        return Err(format!("{} muito antiga (mínimo 01/01/1900)", campo));
    }

    Ok(())
}

#[allow(dead_code)]
pub fn validar_status(status: &str, permitidos: &[&str], campo: &str) -> Result<(), String> {
    if !permitidos.contains(&status) {
        return Err(format!("{} inválido. Valores permitidos: {}", campo, permitidos.join(", ")));
    }

    Ok(())
}

pub fn validar_texto(texto: &str, campo: &str, min: usize, max: usize) -> Result<(), String> {
    if texto.len() < min {
        return Err(format!("{} deve ter pelo menos {} caracteres", campo, min));
    }

    if texto.len() > max {
        return Err(format!("{} muito longo (máx {} caracteres)", campo, max));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validar_cpf_valido() {
        assert!(validar_cpf("935.411.347-80").is_ok());
        assert!(validar_cpf("93541134780").is_ok());
    }

    #[test]
    fn test_validar_cpf_invalido() {
        assert!(validar_cpf("11111111111").is_err());
        assert!(validar_cpf("123").is_err());
    }

    #[test]
    fn test_validar_email() {
        assert!(validar_email("teste@exemplo.com").is_ok());
        assert!(validar_email("email-invalido").is_err());
    }

    #[test]
    fn test_validar_telefone() {
        assert!(validar_telefone("(11) 98765-4321").is_ok());
        assert!(validar_telefone("(11) 3456-7890").is_ok());
        assert!(validar_telefone("12345").is_err());
    }

    #[test]
    fn test_validar_nome() {
        assert!(validar_nome("João", "Nome").is_ok());
        assert!(validar_nome("A", "Nome").is_err());
        assert!(validar_nome("", "Nome").is_err());
    }

    #[test]
    fn test_validar_nome_completo() {
        assert!(validar_nome_completo("João Silva", "Nome").is_ok());
        assert!(validar_nome_completo("Maria da Silva", "Nome").is_ok());
        assert!(validar_nome_completo("Anne-Marie Silva ", "Nome").is_ok());
        assert!(validar_nome_completo("João", "Nome").is_err());
        assert!(validar_nome_completo("João   ", "Nome").is_err());
        assert!(validar_nome_completo("", "Nome").is_err());
    }

    #[test]
    fn test_validar_valor_positivo() {
        assert!(validar_valor_positivo(100.0, "Valor").is_ok());
        assert!(validar_valor_positivo(0.0, "Valor").is_err());
        assert!(validar_valor_positivo(-1.0, "Valor").is_err());
    }

    #[test]
    fn test_validar_data() {
        assert!(validar_data("2000-01-01", "Data", false).is_ok());
        assert!(validar_data("data-invalida", "Data", false).is_err());
    }
}
