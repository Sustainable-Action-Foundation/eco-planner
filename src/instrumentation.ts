// See https://nextjs.org/docs/14/app/building-your-application/optimizing/instrumentation for more details
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      let errorCount = 0;

      // Self-test email functionality
      const mailClient = await import('@/mailClient').then(module => module.default);

      await mailClient.verify().catch(error => {
        console.error("Mail client is not configured correctly: " + error);
        console.warn("Check that the email-related environment variables (`MAIL_HOST`, `MAIL_USER`, `MAIL_PASSWORD`) are set correctly.");
        errorCount++;
      });

      // Self-test database connection
      const prisma = await import('@/prismaClient').then(module => module.default);

      await prisma.$executeRaw`SELECT 1;`.catch(error => {
        console.error("Database connection failed: " + error);
        console.warn("Check that the `DATABASE_URL` environment variable is set correctly.");
        errorCount++;
      });

      // Report self-test results
      if (errorCount > 0) {
        console.warn(`Self-test failed, error count: ${errorCount}`);
      } else {
        console.info("Self-test passed");
      }
    } catch (error) {
      console.error("Unexpected error during self-test: " + error);
    }
  }
}