export function getAdminEmail(): string {
    return (process.env.ADMIN_EMAIL || '').trim();
}

export function isSmtpConfigured(): boolean {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendAdminEmail(subject: string, text: string): Promise<void> {
    const adminEmail = getAdminEmail();
    if (!adminEmail) {
        throw new Error('ADMIN_EMAIL is not configured');
    }
    if (!isSmtpConfigured()) {
        throw new Error('SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS required)');
    }

    // Lazy-load nodemailer so the app still boots without it installed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let nodemailer: any;
    try {
        nodemailer = await import('nodemailer');
    } catch {
        throw new Error('nodemailer package is not installed. Run: npm i nodemailer');
    }
    const transporter = (nodemailer.default ?? nodemailer).createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
        secure: (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: adminEmail,
        subject,
        text,
    });
}
