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
    Serve {
        #[arg(long, short, default_value_t = 3000)]
        port: u16,

        #[arg(long)]
        static_dir: Option<PathBuf>,
    },
    Diff {
        /// Base JSON file (from base branch)
        base: PathBuf,
        /// Head JSON file (from PR branch)
        head: PathBuf,
    },
}

#[derive(Clone, Debug, ValueEnum)]
enum OutputMode {
    Json,
    Debug,
    Summary,
    Markdown,
}

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::init();
    let cli = Cli::parse();

    match cli.command {
        Some(Command::Serve { port, static_dir }) => {
            let bytes = coral::read_stdin()?;
            let fds = coral::decoder::decode(&bytes)?;
            let mut analyzer = coral::Analyzer::default();
            let model = analyzer.analyze(&fds);
            coral::server::serve_with_static(model, port, static_dir).await?;
        }
        Some(Command::Diff { base, head }) => {
            let base_json = std::fs::read_to_string(&base)?;
            let head_json = std::fs::read_to_string(&head)?;

            let base_model: coral::GraphModel = serde_json::from_str(&base_json)?;
            let head_model: coral::GraphModel = serde_json::from_str(&head_json)?;

            let diff = coral::DiffReport::compute(&base_model, &head_model);
            println!("{}", diff.to_markdown());
        }
        None => {
            let bytes = coral::read_stdin()?;
            let fds = coral::decoder::decode(&bytes)?;

            match cli.output {
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
                OutputMode::Markdown => {
                    let mut analyzer = coral::Analyzer::default();
                    let model = analyzer.analyze(&fds);
                    println!("{}", coral::MarkdownReporter::generate(&model));
                }
            }
        }
    }

    Ok(())
}
