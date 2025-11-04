import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

/**
 * 文字起こしAPIエンドポイント
 * POST /api/transcribe
 * Body: { recordingId: string, filePath: string, skipSave?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const { recordingId, filePath, skipSave = false } = await request.json();

    if (!recordingId || !filePath) {
      return NextResponse.json(
        { error: "recordingIdとfilePathが必要です" },
        { status: 400 }
      );
    }

    // OpenAI APIキーのチェック
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey || openaiApiKey === "your-openai-api-key-here") {
      return NextResponse.json(
        {
          error:
            "OpenAI APIキーが設定されていません。.env.localにOPENAI_API_KEYを設定してください。",
        },
        { status: 500 }
      );
    }

    // Supabase設定のチェック（本番環境とローカル環境に対応）
    // 本番: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
    // ローカル: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_KEY
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase環境変数が見つかりません:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        envVars: {
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
        }
      });
      return NextResponse.json(
        { error: "Supabase設定が見つかりません。環境変数SUPABASE_URLとSUPABASE_SERVICE_ROLE_KEYを確認してください。" },
        { status: 500 }
      );
    }

    console.log('使用するSupabase URL:', supabaseUrl);

    // Supabase Admin Clientを作成（Service Role Keyを使用）
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Supabase Storageから音声ファイルをダウンロード
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("recordings")
      .download(filePath);

    if (downloadError || !fileData) {
      console.error("ファイルダウンロードエラー:", downloadError);
      return NextResponse.json(
        {
          error: `ファイルのダウンロードに失敗しました: ${downloadError?.message}`,
        },
        { status: 500 }
      );
    }

    // 2. OpenAI Whisper APIで文字起こし
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // BlobをFileオブジェクトに変換（OpenAI SDKが期待する形式）
    const file = new File(
      [fileData],
      filePath.split("/").pop() || "audio.webm",
      {
        type: "audio/webm",
      }
    );

    console.log("文字起こし開始:", {
      recordingId,
      filePath,
      fileSize: file.size,
    });

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "ja", // 日本語を指定
      response_format: "text",
    });

    console.log("文字起こし完了:", {
      recordingId,
      length: transcription.length,
    });

    // 3. データベースに保存（skipSaveがfalseの場合のみ）
    if (!skipSave) {
      const { error: updateError } = await supabase
        .from("recordings")
        .update({ transcription })
        .eq("id", recordingId);

      if (updateError) {
        console.error("データベース更新エラー:", updateError);
        return NextResponse.json(
          { error: `データベースの更新に失敗しました: ${updateError.message}` },
          { status: 500 }
        );
      }

      console.log("データベース更新完了:", { recordingId });
    } else {
      console.log("データベース保存をスキップ:", { recordingId });
    }

    return NextResponse.json({
      success: true,
      transcription,
    });
  } catch (error) {
    console.error("文字起こしエラー:", error);
    const errorMessage =
      error instanceof Error ? error.message : "不明なエラー";
    return NextResponse.json(
      { error: `文字起こしに失敗しました: ${errorMessage}` },
      { status: 500 }
    );
  }
}
