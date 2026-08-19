/**
 * Notification Service Stub
 * Handles dispatching notifications via WhatsApp or Email channels.
 */

const send = async (channel, to, templateName, variables = {}) => {
  console.log('\n=================== [NOTIFICATION SERVICE STUB] ===================');
  console.log(`[CHANNEL]   : ${channel.toUpperCase()}`);
  console.log(`[RECIPIENT] : ${to}`);
  console.log(`[TEMPLATE]  : ${templateName}`);
  console.log(`[VARIABLES] :`, JSON.stringify(variables, null, 2));
  console.log('===================================================================\n');

  if (channel === 'whatsapp') {
    // TODO: Integrate WhatsApp Business API / Twilio Client SDK
    // Example: await twilioClient.messages.create({ from: 'whatsapp:+14155238886', to: `whatsapp:${to}`, body: formattedText });
  } else if (channel === 'email') {
    // TODO: Integrate Nodemailer / SendGrid Transporter
    // Example: await mailTransporter.sendMail({ from: 'no-reply@jslabels.com', to, subject: templateSubject, html: renderedTemplate });
  }

  return { success: true, messageId: `stub-${Date.now()}` };
};

module.exports = {
  send
};
