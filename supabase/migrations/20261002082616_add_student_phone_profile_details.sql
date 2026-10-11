/*\n# Add Student Phone Profile Details\n\n## Overview\nStores a student's phone number during registration so administrators can see complete contact details alongside enrollment and mock-test purchase history.\n\n## Modified Tables\n- `profiles.phone_number` - Optional phone number captured during signup.\n\n## Signup Behavior\n- The signup form sends the phone number in the account metadata.\n- The profile creation trigger copies it into `profiles.phone_number` for new accounts.\n- Existing profiles remain valid and can have an empty phone number.\n\n## Security\n- The existing authenticated profile policy remains in place.\n- Administrators can view the phone number as part of user management

 students retain access only to their own profile row.\n*/\n\nALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text

\n\nCREATE OR REPLACE FUNCTION public.handle_new_user()\nRETURNS trigger\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  INSERT INTO public.profiles (id, full_name, email, role, phone_number)\n  VALUES (\n    NEW.id,\n    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),\n    NEW.email,\n    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),\n    NULLIF(NEW.raw_user_meta_data->>'phone_number', '')\n  )

\n  RETURN NEW

\nEND

\n$$

\n
