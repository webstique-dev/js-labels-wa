// Contact Action Helpers & Icons for Call, WhatsApp, and Email

import React from 'react';

/**
 * Initiates phone call via tel: URI scheme
 */
export const initiatePhoneCall = (phone, name, notify) => {
  if (!phone) {
    if (notify) notify.info(`No phone number recorded for ${name || 'contact'}`);
    return false;
  }
  const cleanPhone = phone.toString().replace(/\D/g, '');
  if (cleanPhone.length !== 10) {
    if (notify) notify.warning(`Phone number for ${name} is invalid (${phone})`);
  }
  window.location.href = `tel:+91${cleanPhone}`;
  if (notify) notify.success(`Initiating call to ${name || 'contact'} (+91 ${cleanPhone})...`);
  return true;
};

/**
 * Opens WhatsApp chat via wa.me with pre-formatted message based on reorder probability
 */
export const openWhatsApp = (phone, name, customMsg, notify, reorderProb, expectedReorderDate) => {
  if (!phone) {
    if (notify) notify.info(`No phone number recorded for ${name || 'contact'}`);
    return false;
  }
  const cleanPhone = phone.toString().replace(/\D/g, '');
  const expDateStr = expectedReorderDate
    ? new Date(expectedReorderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'soon';

  let defaultMsg = '';
  const prob = reorderProb ?? 0;
  if (prob >= 80) {
    defaultMsg = `Hi ${name || 'Customer'}, this is JS Labels. Your label supply is expected to need a reorder around ${expDateStr} (${prob}% reorder probability). Would you like us to prepare your next batch of custom labels today?`;
  } else if (prob >= 50) {
    defaultMsg = `Hi ${name || 'Customer'}, greetings from JS Labels! Based on your usage cycle, your next label reorder is expected around ${expDateStr}. Please let us know if you'd like us to prepare your upcoming order!`;
  } else {
    defaultMsg = `Hi ${name || 'Customer'}, hope you are doing well! JS Labels is following up to check on your label inventory. Feel free to reach out whenever you're ready for your next reorder!`;
  }

  const msg = customMsg || defaultMsg;
  const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
  if (notify) notify.success(`Opening WhatsApp chat for ${name || 'contact'}...`);
  return true;
};

/**
 * Opens pre-formatted email via mailto: URI scheme
 */
export const openEmail = (email, name, customSubject, customBody, notify) => {
  if (!email || !email.trim()) {
    if (notify) notify.info(`No email address recorded for ${name || 'contact'}`);
    return false;
  }
  const subject = customSubject || `Following up from JS Labels`;
  const body = customBody || `Hi ${name || 'there'},\n\nThank you for reaching out to JS Labels. We would love to discuss your custom label and packaging requirements.\n\nBest regards,\nJS Labels Team`;
  window.location.href = `mailto:${email.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (notify) notify.success(`Opening email client for ${name || 'contact'}...`);
  return true;
};

/**
 * Official Filled WhatsApp Icon Component
 */
export const WhatsAppIcon = ({ size = 14, className = "w-3.5 h-3.5" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 2C6.477 2 2 6.477 2 12c0 2.159.684 4.156 1.848 5.79L2.5 21.5l3.822-1.31C7.882 21.282 9.87 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.884 0-3.633-.538-5.116-1.468l-.367-.229-2.275.78.795-2.217-.251-.38A7.957 7.957 0 0 1 4 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/>
  </svg>
);
