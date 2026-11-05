import { redirect } from 'next/navigation';

// The resume editor now lives on the profile page. Old links keep working.
export default function ResumeRedirect() {
  redirect('/student/profile?tab=resume');
}
