import { NextRequest } from "next/server";
import { allowedDomains } from "@/lib/allowedDomains";
import prisma from "@/prismaClient"
import bcrypt from "bcryptjs";
import mailClient from "@/mailClient";
import getUserHash from "@/functions/getUserHash";
import { baseUrl } from "@/lib/baseUrl";
import serveTea from "@/lib/i18nServer";
import Mail from "nodemailer/lib/mailer";

export async function POST(request: NextRequest) {
  const t = await serveTea("email");

  const { username, email, password }: { username: string; email: string; password: string; } = await request.json();

  // Validate request body
  if (!username || !email || !password) {
    return Response.json({ message: 'Username, email, and password are required' },
      { status: 400 }
    );
  }
  const lowercaseEmail = email.toLowerCase();

  // Check if email or username already exists; this is implicitly done by Prisma when creating a new user,
  // but we want to return a more specific error message
  const usernameExists = await prisma.user.findUnique({
    where: {
      username: username,
    }
  });

  if (usernameExists) {
    return Response.json({ message: 'Username "' + username + '" is already taken' },
      { status: 400 }
    );
  }

  const emailExists = await prisma.user.findUnique({
    where: {
      email: lowercaseEmail,
    }
  });

  if (emailExists) {
    return Response.json({ message: 'Email "' + lowercaseEmail + '" is already in use' },
      { status: 400 }
    );
  }

  // Check if email belongs to an allowed domain
  // Get the part after last '@' to support emails like `"john@doe"@example.com`, and trim any whitespace or trailing '>' character (e.g. if the email is in the format `John Doe <john.doe@example.com>`)
  const domain = lowercaseEmail.split('@').pop()?.trim().replace(/>$/, '').trim();
  /** A regex matching domain names according to RFC 1035 and RFC 1123 */
  const domainRegex = /^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?)*$/;
  if (!domainRegex.test(domain ?? '')) {
    return Response.json({ message: `Failed to parse domain '${domain}'.` },
      { status: 400 }
    );
  }

  // Check if the domain ends with any of the allowed domains (to allow subdomains)
  if (!allowedDomains.some((allowedDomain) => (domain === allowedDomain) || (domain ?? '').endsWith('.' + allowedDomain))) {
    return Response.json({ message: `Email domain '${domain}' is not allowed` },
      { status: 400 }
    );
  }

  // Hash password
  const saltRounds: number = 11;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // If mailClient does not verify, don't try to create the user since something on the server is misconfigured. If only the sendVerificationEmail function fails, the user can try requesting a new verification email later.
  try {
    await mailClient.verify().catch(error => { console.log(error); throw error; });
  } catch (error) {
    console.log(error);
    return Response.json({ message: 'Problem connecting to email service; User not created since server is misconfigured. Please try again later' },
      { status: 500 }
    );
  }

  // Create user
  try {
    await prisma.user.create({
      data: {
        username: username,
        email: lowercaseEmail,
        password: hashedPassword,
        userGroups: {
          connectOrCreate: {
            where: {
              name: lowercaseEmail.split('@')[1],
            },
            create: {
              name: lowercaseEmail.split('@')[1],
            },
          },
        },
      },
    });
  } catch (error) {
    console.log(error);
    return Response.json({ message: 'Error creating user' },
      { status: 500 }
    );
  }

  // Send verification email. This is done after creating the user to avoid sending an email if the user creation fails.
  // If the sendMail function fails, the user is still created and can try to verify their email later.
  try {
    const userHash = await getUserHash(lowercaseEmail);
    if (!userHash) {
      throw new Error('User not found');
    }

    const mailContent: Mail.Options = {
      from: t("email:common.from", { emailServer: process.env.MAIL_USER }),
      to: lowercaseEmail,
      subject: t("email:signup.subject"),
      text: t("email:signup.body", { baseUrl: baseUrl, email: lowercaseEmail, userHash: userHash }),
    };

    await mailClient.sendMail(mailContent).catch((error) => {
      console.log(error);
      throw new Error('Error sending verification email');
    });
  } catch {
    return Response.json({ message: 'User created, but failed to send verification email' },
      {
        status: 200,
        headers: { 'Location': '/verify' }
      }
    );
  }

  return Response.json({ message: 'User created' },
    {
      status: 200,
      headers: { 'Location': '/verify' }
    }
  )
}