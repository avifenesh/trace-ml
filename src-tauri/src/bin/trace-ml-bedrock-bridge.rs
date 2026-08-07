fn main() {
    if let Err(error) = trace_ml_lib::run_bedrock_bridge() {
        eprintln!("error: {error}");
        std::process::exit(1);
    }
}
