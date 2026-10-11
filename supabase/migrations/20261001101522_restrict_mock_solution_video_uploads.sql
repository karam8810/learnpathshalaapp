/*\n# Restrict Mock Solution Video Uploads\n\n## Overview\nAdds storage-level limits for optional mock question solution videos.\n\n## Storage Changes\n- Limits each solution video to 100 MB.\n- Allows common video formats only.\n\n## Security\nThese limits are enforced by Supabase Storage, not only by the upload form.\n*/\nUPDATE storage.buckets\nSET public = false,\n    file_size_limit = 104857600,\n    allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']\nWHERE id = 'mock-solution-videos'

\n
