mod bedrock;
mod lesson_helper;
mod prose_assessment;

#[tauri::command]
async fn answer_lesson_question(
    window: tauri::WebviewWindow,
    service: tauri::State<'_, lesson_helper::LessonHelperService>,
    request: lesson_helper::LessonHelperRequest,
) -> Result<lesson_helper::LessonHelperAnswer, String> {
    lesson_helper::answer(&service, window.label(), request).await
}

#[tauri::command]
fn cancel_lesson_answer(
    window: tauri::WebviewWindow,
    service: tauri::State<'_, lesson_helper::LessonHelperService>,
    request_id: String,
) -> Result<bool, String> {
    service.cancel(window.label(), &request_id)
}

#[tauri::command]
async fn lesson_helper_ready(
    window: tauri::WebviewWindow,
    service: tauri::State<'_, lesson_helper::LessonHelperService>,
) -> Result<bedrock::BedrockReadiness, String> {
    service.readiness(window.label()).await
}

#[tauri::command]
async fn assess_prose(
    window: tauri::WebviewWindow,
    service: tauri::State<'_, prose_assessment::ProseAssessmentService>,
    request: prose_assessment::ProseAssessmentRequest,
) -> Result<prose_assessment::ProseAssessment, String> {
    prose_assessment::assess(&service, window.label(), request).await
}

#[tauri::command]
fn cancel_prose_assessment(
    window: tauri::WebviewWindow,
    service: tauri::State<'_, prose_assessment::ProseAssessmentService>,
    request_id: String,
) -> Result<bool, String> {
    service.cancel(window.label(), &request_id)
}

#[tauri::command]
async fn prose_assessment_ready(
    window: tauri::WebviewWindow,
    service: tauri::State<'_, prose_assessment::ProseAssessmentService>,
) -> Result<bedrock::BedrockReadiness, String> {
    service.readiness(window.label()).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let lesson_helper_service = lesson_helper::LessonHelperService::new()
        .expect("failed to initialize lesson helper service");
    let prose_assessment_service = prose_assessment::ProseAssessmentService::new()
        .expect("failed to initialize prose assessment service");
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(lesson_helper_service)
        .manage(prose_assessment_service)
        .invoke_handler(tauri::generate_handler![
            answer_lesson_question,
            cancel_lesson_answer,
            lesson_helper_ready,
            assess_prose,
            cancel_prose_assessment,
            prose_assessment_ready
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
