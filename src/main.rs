use std::path::PathBuf;

use anyhow::Result;
use clap::{Parser, Subcommand, ValueEnum};

#[derive(Parser, Debug)]
#[command(
    name = "coral",
    version,
    about = "Proto dependency visualizer for gRPC/Connect projects"
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,

    #[arg(long, short, value_enum, default_value_t = OutputMode::Json, global = true)]
    output: OutputMode,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Start the web server to visualize proto dependencies
    Serve {
        /// Port to listen on
        #[arg(long, short, default_value_t = 3000)]
        port: u16,

        /// Directory to serve static files from (optional)
        #[arg(long)]
        static_dir: Option<PathBuf>,
    },
}

#[derive(Clone, Debug, ValueEnum)]
enum OutputMode {
    Json,
    Debug,
    Summary,
}

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::init();
    let cli = Cli::parse();

    let bytes = coral::read_stdin()?;
    let fds = coral::decoder::decode(&bytes)?;

    match cli.command {
        Some(Command::Serve { port, static_dir }) => {
            let mut analyzer = coral::Analyzer::default();
            let model = analyzer.analyze(&fds);
            coral::server::serve_with_static(model, port, static_dir).await?;
        }
        None => match cli.output {
            OutputMode::Json => {
                let mut analyzer = coral::Analyzer::default();
                let model = analyzer.analyze(&fds);
                println!("{}", serde_json::to_string_pretty(&model)?);
            }
            OutputMode::Debug => {
                coral::debug_output(&fds);
            }
            OutputMode::Summary => {
                println!("Files: {}", fds.file.len());

                let services = fds.file.iter().filter(|f| !f.service.is_empty()).count();
                let messages = fds.file.iter().map(|f| f.message_type.len()).sum::<usize>();
                let enums = fds.file.iter().map(|f| f.enum_type.len()).sum::<usize>();

                println!("Services: {services}");
                println!("Messages: {messages}");
                println!("Enums: {enums}");
            }
        },
    }

    Ok(())
}
