# Webhooks and S3 Integration with Supabase

This example showcases how to integrate SimplePDF with Supabase using edge functions to listen to incoming submissions notifications.

Additionally, SimplePDF is configured with the S3-compatible Supabase storage, the function `extractBucketPathFromSupabaseStorageUrl` assumes that the Supabase storage is used.

## Requirements

1. A project on Supabase

2. A database `simplepdf_submissions`

```
create table
  public.simplepdf_submissions (
    id bigint generated by default as identity not null,
    document_name text not null,
    document_id text null,
    submission_id text null,
    submission_bucket_path text null,
    context jsonb null,
    constraint simplepdf - submissions_pkey primary key (id)
  ) tablespace pg_default;
```

3. RLS configured to allow the `anon` role to insert rows in `simplepdf_submissions`

```
alter policy "Allow edge function to insert into simplepdf_submissions"
  on "public"."simplepdf_submissions"
  to anon
  with check (true);
```

4. Optional: Storage configured on SimplePDF using Access Key / Secret

## How to use the integration

1. Deploy the function
   _Replace "<PROJECT_ID>" with your project's ID in the deploy command in package.json_

```
npm run deploy
```

2. Disable `Enforce JWT Verification` for this function in your Supabase project

3. Configure webhooks to call the deployed function - [how to configure webhooks in SimplePDF](https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions)

4. Submit any document using your SimplePDF account

5. A new row will appear in `simplepdf_submissions` and a new entry in your storage if you configured it
