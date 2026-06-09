import emailjs from '@emailjs/browser';

const SERVICE_ID  = 'service_x5tpab8';
const TEMPLATE_ID = 'template_vf1sj8p';
const PUBLIC_KEY  = 'ofZehvFR7JZdFBNXx';

/**
 * إرسال إيميل ترحيب مع رابط تعيين كلمة المرور
 */
export async function sendWelcomeEmail(
  toName:     string,
  toEmail:    string,
  resetLink:  string,
): Promise<void> {
  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_name:    toName,
      email:      toEmail,
      reset_link: resetLink,
    },
    PUBLIC_KEY,
  );
}
