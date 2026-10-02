fn main() {
    tauri_build::build();

    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let pub_key_path = std::path::Path::new(&manifest_dir).join("dev_public_key.bin");

    if !pub_key_path.exists() {
        use ed25519_dalek::SigningKey;
        use rand::rngs::OsRng;

        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let verifying_key = signing_key.verifying_key();

        std::fs::write(&pub_key_path, verifying_key.to_bytes()).unwrap();
        std::fs::write(
            std::path::Path::new(&manifest_dir).join("dev_private_key.bin"),
            signing_key.to_bytes(),
        )
        .unwrap();

        println!("cargo:warning=Generated new Ed25519 development key pair");
        println!("cargo:warning=  dev_public_key.bin and dev_private_key.bin created");
    }
}
