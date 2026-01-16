// See https://nextjs.org/docs/14/app/building-your-application/optimizing/instrumentation for more details
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      let errorCount = 0;

      // Self-test IronSession configuration
      const { options } = await import('@/lib/session').then(module => module);
      if (options.password instanceof Array) {
        if (options.password.length === 0) {
          console.error("IronSession password is not set.");
          errorCount++;
        } else {
          if (options.password.some(pass => !(typeof pass !== 'string') || (pass as string).length < 32)) {
            console.error("At least one IronSession password is misconfigured.");
            errorCount++;
          }
        }
      } else if (typeof options.password !== 'string' || options.password.length < 32) {
        console.error("IronSession password is misconfigured.");
        console.warn("Check that the `IRON_SESSION_PASSWORD` environment variable is at least 32 characters long.");
        errorCount++;
      }

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
      console.error("Unexpected error during self-test: ", error);
    }
  }
}