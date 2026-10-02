use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use serde::{Serialize, Deserialize};
use chrono::{Utc, Duration};
use sha2::{Sha256, Digest};

pub fn get_jwt_secret() -> Vec<u8> {
    if let Ok(secret) = std::env::var("JWT_SECRET") {
        return secret.into_bytes();
    }
    uuid::Uuid::new_v4().to_string().into_bytes()
}

pub const TOKEN_EXPIRY_HOURS: i64 = 8;
pub const REFRESH_TOKEN_EXPIRY_DAYS: i64 = 30;
pub const MAX_LOGIN_ATTEMPTS: i32 = 5;
pub const LOCKOUT_MINUTES: i64 = 15;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: i64,
    pub username: String,
    pub role: String,
    pub exp: usize,
    pub iat: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
}

pub fn generate_tokens(user_id: i64, username: &str, role: &str) -> Result<AuthTokens, String> {
    let now = Utc::now();
    let access_exp = (now + Duration::hours(TOKEN_EXPIRY_HOURS)).timestamp() as usize;
    let refresh_exp = (now + Duration::days(REFRESH_TOKEN_EXPIRY_DAYS)).timestamp() as usize;

    let access_claims = Claims {
        sub: user_id,
        username: username.to_string(),
        role: role.to_string(),
        exp: access_exp,
        iat: now.timestamp() as usize,
    };

    let secret = get_jwt_secret();
    let access_token = encode(
        &Header::default(),
        &access_claims,
        &EncodingKey::from_secret(&secret),
    ).map_err(|e| format!("Erro ao gerar token: {}", e))?;

    let refresh_claims = Claims {
        sub: user_id,
        username: username.to_string(),
        role: role.to_string(),
        exp: refresh_exp,
        iat: now.timestamp() as usize,
    };

    let refresh_token = encode(
        &Header::default(),
        &refresh_claims,
        &EncodingKey::from_secret(&secret),
    ).map_err(|e| format!("Erro ao gerar refresh token: {}", e))?;

    Ok(AuthTokens {
        access_token,
        refresh_token,
        expires_in: TOKEN_EXPIRY_HOURS * 3600,
    })
}

pub fn validate_token(token: &str) -> Result<Claims, String> {
    let secret = get_jwt_secret();
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(&secret),
        &Validation::default(),
    ).map_err(|e| format!("Token inválido: {}", e))?;
    Ok(token_data.claims)
}

pub fn token_hash(token: &str) -> String {
    format!("{:x}", Sha256::digest(token.as_bytes()))
}
