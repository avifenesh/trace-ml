use serde_json::Value;
use std::{env, fs, path::PathBuf, time::Duration};

pub(crate) const BEDROCK_ENDPOINT: &str =
    "https://bedrock-mantle.us-east-1.api.aws/openai/v1/responses";
pub(crate) const BEDROCK_MODEL: &str = "openai.gpt-5.6-sol";

pub(crate) fn client(
    timeout: Duration,
    user_agent: &'static str,
    error: &'static str,
) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .https_only(true)
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(timeout)
        .user_agent(user_agent)
        .build()
        .map_err(|_| error.to_string())
}

fn env_value(contents: &str, key: &str) -> Option<String> {
    contents.lines().find_map(|line| {
        let line = line.trim().strip_prefix("export ").unwrap_or(line.trim());
        let (name, value) = line.split_once('=')?;
        if name.trim() != key {
            return None;
        }
        let value = value.trim();
        let unquoted = if value.len() >= 2
            && ((value.starts_with('"') && value.ends_with('"'))
                || (value.starts_with('\'') && value.ends_with('\'')))
        {
            &value[1..value.len() - 1]
        } else {
            value
        };
        (!unquoted.is_empty()).then(|| unquoted.to_string())
    })
}

pub(crate) fn token() -> Result<String, String> {
    if let Ok(value) = env::var("AWS_BEARER_TOKEN_BEDROCK") {
        if !value.trim().is_empty() {
            return Ok(value);
        }
    }

    let home = env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "Bedrock credentials are unavailable.".to_string())?;
    let path = home.join(".config/claude/bedrock.env");
    let contents =
        fs::read_to_string(path).map_err(|_| "Bedrock credentials are unavailable.".to_string())?;
    env_value(&contents, "AWS_BEARER_TOKEN_BEDROCK")
        .ok_or_else(|| "Bedrock credentials are unavailable.".to_string())
}

pub(crate) fn single_assistant_output_text<'a>(
    response: &'a Value,
    incomplete_error: &str,
    output_error: &str,
) -> Result<&'a str, String> {
    if response.get("status").and_then(Value::as_str) != Some("completed") {
        return Err(incomplete_error.to_string());
    }

    let output = response
        .get("output")
        .and_then(Value::as_array)
        .ok_or_else(|| output_error.to_string())?;
    let mut output_text = None;
    for item in output {
        match item.get("type").and_then(Value::as_str) {
            Some("reasoning") => {}
            Some("message") => {
                if output_text.is_some()
                    || item.get("role").and_then(Value::as_str) != Some("assistant")
                {
                    return Err(output_error.to_string());
                }
                let content = item
                    .get("content")
                    .and_then(Value::as_array)
                    .filter(|content| content.len() == 1)
                    .ok_or_else(|| output_error.to_string())?;
                let text = content[0]
                    .get("text")
                    .and_then(Value::as_str)
                    .filter(|text| !text.trim().is_empty())
                    .ok_or_else(|| output_error.to_string())?;
                if content[0].get("type").and_then(Value::as_str) != Some("output_text") {
                    return Err(output_error.to_string());
                }
                output_text = Some(text);
            }
            _ => return Err(output_error.to_string()),
        }
    }

    output_text.ok_or_else(|| output_error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn bedrock_env_parser_accepts_exported_and_quoted_values() {
        assert_eq!(
            env_value(
                "export AWS_BEARER_TOKEN_BEDROCK='secret-value'\nAWS_REGION=us-east-1",
                "AWS_BEARER_TOKEN_BEDROCK",
            ),
            Some("secret-value".to_string())
        );
    }

    #[test]
    fn accepts_only_one_assistant_text_with_passive_reasoning() {
        let response = json!({
            "status": "completed",
            "output": [
                {"type": "reasoning", "summary": []},
                {
                    "type": "message",
                    "role": "assistant",
                    "content": [{"type": "output_text", "text": "{\"ok\":true}"}]
                }
            ]
        });

        assert_eq!(
            single_assistant_output_text(&response, "incomplete", "invalid").unwrap(),
            "{\"ok\":true}"
        );
    }

    #[test]
    fn rejects_tool_calls_even_beside_valid_text() {
        for tool_type in [
            "function_call",
            "web_search_call",
            "computer_call",
            "mcp_call",
        ] {
            let response = json!({
                "status": "completed",
                "output": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "content": [{"type": "output_text", "text": "{\"ok\":true}"}]
                    },
                    {"type": tool_type}
                ]
            });
            assert!(
                single_assistant_output_text(&response, "incomplete", "invalid").is_err(),
                "{tool_type} should be rejected"
            );
        }
    }

    #[test]
    fn rejects_non_assistant_or_multi_content_messages() {
        let wrong_role = json!({
            "status": "completed",
            "output": [{
                "type": "message",
                "role": "tool",
                "content": [{"type": "output_text", "text": "{\"ok\":true}"}]
            }]
        });
        assert!(single_assistant_output_text(&wrong_role, "incomplete", "invalid").is_err());

        let mixed_content = json!({
            "status": "completed",
            "output": [{
                "type": "message",
                "role": "assistant",
                "content": [
                    {"type": "output_text", "text": "{\"ok\":true}"},
                    {"type": "refusal", "refusal": "No."}
                ]
            }]
        });
        assert!(single_assistant_output_text(&mixed_content, "incomplete", "invalid").is_err());
    }
}
