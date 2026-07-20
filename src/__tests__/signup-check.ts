import { AuthService } from '@/features/auth';

async function run() {
  const email = `test-${Date.now()}@example.com`;
  console.log('Signing up:', email);
  const signupRes = await AuthService.signUp(email, 'password123', 'Test User');
  console.log('Signup Result:', signupRes);
  if (signupRes.success) {
    const user = signupRes.data;
    console.log('User signed up. Email confirmed?', user?.email_confirmed_at);
  }
}

run().catch(console.error);
