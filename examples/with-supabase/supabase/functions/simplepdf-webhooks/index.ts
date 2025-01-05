import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const extractBucketPathFromSupabaseStorageUrl = (
  url: string,
): string | null => {
  const regex = /\/storage\/v1\/s3\/(.+?)\?/;
  const match = url.match(regex);

  if (match && match[1]) {
    return match[1];
  }

  return null;
};

Deno.serve(async (req) => {
  try {
    const incomingEvent = await req.json();

    if (incomingEvent.type !== "submission.created") {
      console.log(`Unsupported event: ${incomingEvent.type}`);
      return new Response(JSON.stringify({}), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { document, submission, context } = incomingEvent.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: {} } },
    );

    const { error } = await supabase.from("simplepdf_submissions").insert({
      document_name: document.name,
      document_id: document.id,
      submission_id: submission.id,
      submission_bucket_path: extractBucketPathFromSupabaseStorageUrl(
        submission.url,
      ),
      context: context,
    });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({}), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error(err);
    return new Response(String(err?.message ?? err), { status: 500 });
  }
});
