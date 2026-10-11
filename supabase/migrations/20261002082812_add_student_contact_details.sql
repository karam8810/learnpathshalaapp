/*\n# Add Student Contact Details\n\n## Overview\nAdds phone number and address fields to student profiles. New signups save these values automatically, and existing profiles remain valid with empty values until updated.\n\n## Modified Tables\n- `profiles.phone` - Optional phone number supplied during signup.\n- `profiles.address` - Optional mailing or home address supplied during signup.\n\n## Signup Behavior\nThe existing signup trigger now copies phone and address from the signup metadata into the profile row.\n\n## Security\nThe existing authenticated profile policies continue to protect profile writes. Admins can view student contact details through the admin dashboard.\n*/\n\nALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text

\nALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text

\n\nCREATE OR REPLACE FUNCTION public.handle_new_user()\nRETURNS trigger\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  INSERT INTO public.profiles (id, full_name, email, role, phone, address)\n  VALUES (\n    NEW.id,\n    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),\n    NEW.email,\n    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),\n    NULLIF(NEW.raw_user_meta_data->>'phone', ''),\n    NULLIF(NEW.raw_user_meta_data->>'address', '')\n  )

\n  RETURN NEW

\nEND

\n$$

\n
