use crate::{lesson_helper, prose_assessment};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    io::{self, BufRead, BufWriter, Write},
    sync::{Arc, Mutex},
    thread,
};

const AUTHORIZED_CLIENT: &str = "main";
const MAX_COMMAND_BYTES: usize = 512 * 1_024;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BridgeCommand {
    id: String,
    action: BridgeAction,
    #[serde(default)]
    payload: Value,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
enum BridgeAction {
    Ping,
    LessonHelperReady,
    AnswerLessonQuestion,
    CancelLessonAnswer,
    ProseAssessmentReady,
    AssessProse,
    CancelProseAssessment,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CancelRequest {
    request_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SuccessResponse<T> {
    id: String,
    ok: bool,
    result: T,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorResponse {
    id: String,
    ok: bool,
    error: String,
}

type BridgeOutput = Arc<Mutex<BufWriter<io::Stdout>>>;

fn write_value<T: Serialize>(output: &BridgeOutput, value: &T) {
    let Ok(mut writer) = output.lock() else {
        return;
    };
    if serde_json::to_writer(&mut *writer, value).is_ok() {
        let _ = writer.write_all(b"\n");
        let _ = writer.flush();
    }
}

fn write_result<T: Serialize>(output: &BridgeOutput, id: String, result: Result<T, String>) {
    match result {
        Ok(result) => write_value(
            output,
            &SuccessResponse {
                id,
                ok: true,
                result,
            },
        ),
        Err(error) => write_value(
            output,
            &ErrorResponse {
                id,
                ok: false,
                error,
            },
        ),
    }
}

fn command_from_line(line: &str) -> Result<BridgeCommand, (String, String)> {
    let value = serde_json::from_str::<Value>(line)
        .map_err(|_| ("invalid".to_string(), "Invalid bridge command.".to_string()))?;
    let id = value
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("invalid")
        .to_string();
    let command = serde_json::from_value::<BridgeCommand>(value)
        .map_err(|_| (id.clone(), "Invalid bridge command.".to_string()))?;
    if command.id.trim().is_empty() || command.id.chars().count() > 128 {
        return Err((id, "Invalid bridge command id.".to_string()));
    }
    Ok(command)
}

pub(crate) fn run() -> Result<(), String> {
    let lesson_helper = Arc::new(lesson_helper::LessonHelperService::new()?);
    let prose_assessment = Arc::new(prose_assessment::ProseAssessmentService::new()?);
    let output = Arc::new(Mutex::new(BufWriter::new(io::stdout())));
    let stdin = io::stdin();

    for line in stdin.lock().lines() {
        let line = line.map_err(|_| "Could not read a bridge command.".to_string())?;
        if line.len() > MAX_COMMAND_BYTES {
            write_result::<Value>(
                &output,
                "invalid".to_string(),
                Err("Bridge command is too large.".to_string()),
            );
            continue;
        }
        let command = match command_from_line(&line) {
            Ok(command) => command,
            Err((id, error)) => {
                write_result::<Value>(&output, id, Err(error));
                continue;
            }
        };

        match command.action {
            BridgeAction::Ping => write_result(
                &output,
                command.id,
                Ok(serde_json::json!({
                    "service": "trace-ml-bedrock-bridge",
                    "status": "ok"
                })),
            ),
            BridgeAction::LessonHelperReady => {
                let service = Arc::clone(&lesson_helper);
                let output = Arc::clone(&output);
                thread::spawn(move || {
                    let result =
                        tauri::async_runtime::block_on(service.readiness(AUTHORIZED_CLIENT));
                    write_result(&output, command.id, result);
                });
            }
            BridgeAction::AnswerLessonQuestion => {
                let request =
                    serde_json::from_value::<lesson_helper::LessonHelperRequest>(command.payload);
                let service = Arc::clone(&lesson_helper);
                let output = Arc::clone(&output);
                thread::spawn(move || {
                    let result = request
                        .map_err(|_| "Invalid lesson-helper request.".to_string())
                        .and_then(|request| {
                            tauri::async_runtime::block_on(lesson_helper::answer(
                                &service,
                                AUTHORIZED_CLIENT,
                                request,
                            ))
                        });
                    write_result(&output, command.id, result);
                });
            }
            BridgeAction::CancelLessonAnswer => {
                let result = serde_json::from_value::<CancelRequest>(command.payload)
                    .map_err(|_| "Invalid lesson-helper cancellation.".to_string())
                    .and_then(|request| {
                        lesson_helper.cancel(AUTHORIZED_CLIENT, &request.request_id)
                    });
                write_result(&output, command.id, result);
            }
            BridgeAction::ProseAssessmentReady => {
                let service = Arc::clone(&prose_assessment);
                let output = Arc::clone(&output);
                thread::spawn(move || {
                    let result =
                        tauri::async_runtime::block_on(service.readiness(AUTHORIZED_CLIENT));
                    write_result(&output, command.id, result);
                });
            }
            BridgeAction::AssessProse => {
                let request = serde_json::from_value::<prose_assessment::ProseAssessmentRequest>(
                    command.payload,
                );
                let service = Arc::clone(&prose_assessment);
                let output = Arc::clone(&output);
                thread::spawn(move || {
                    let result = request
                        .map_err(|_| "Invalid prose-assessment request.".to_string())
                        .and_then(|request| {
                            tauri::async_runtime::block_on(prose_assessment::assess(
                                &service,
                                AUTHORIZED_CLIENT,
                                request,
                            ))
                        });
                    write_result(&output, command.id, result);
                });
            }
            BridgeAction::CancelProseAssessment => {
                let result = serde_json::from_value::<CancelRequest>(command.payload)
                    .map_err(|_| "Invalid prose-assessment cancellation.".to_string())
                    .and_then(|request| {
                        prose_assessment.cancel(AUTHORIZED_CLIENT, &request.request_id)
                    });
                write_result(&output, command.id, result);
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_only_named_bounded_bridge_commands() {
        let command =
            command_from_line(r#"{"id":"request-1","action":"ping","payload":{}}"#).unwrap();
        assert_eq!(command.id, "request-1");
        assert!(matches!(command.action, BridgeAction::Ping));

        assert!(command_from_line(
            r#"{"id":"request-2","action":"arbitraryModelProxy","payload":{}}"#
        )
        .is_err());
        assert!(command_from_line(
            &serde_json::json!({
                "id": "x".repeat(129),
                "action": "ping",
                "payload": {}
            })
            .to_string()
        )
        .is_err());
    }

    #[test]
    fn cancellation_payload_rejects_extra_fields() {
        assert!(serde_json::from_value::<CancelRequest>(serde_json::json!({
            "requestId": "request-1",
            "prompt": "not allowed"
        }))
        .is_err());
    }
}
