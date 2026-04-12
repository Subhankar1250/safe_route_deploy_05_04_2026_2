import { supabase } from '@/integrations/supabase/client';

export interface WelcomeNotificationData {
  recipient_type: 'driver' | 'guardian';
  name: string;
  mobile_number?: string;
  bus_number?: string;
  pickup_point?: string;
  driver_name?: string;
  /** Shown once in welcome messages; PIN is stored hashed in the database. */
  initial_portal_pin?: string;
}

export interface StudentActionNotificationData {
  student_name: string;
  guardian_name: string;
  /** SMS / WhatsApp; push + in-app still work when only guardian_profile_id is set. */
  guardian_mobile?: string;
  /** When set, sends FCM + Realtime + in-app center via send-push-notification. */
  guardian_profile_id?: string;
  action: "pickup" | "drop";
  time: string;
  bus_number: string;
  driver_name: string;
  pickup_point: string;
}

function digitsMobile(m: string | undefined): string {
  return (m ?? "").replace(/\D/g, "");
}

export const sendStudentActionNotification = async (data: StudentActionNotificationData) => {
  try {
    const actionText = data.action === "pickup" ? "picked up" : "dropped at home";
    const actionPast = data.action === "pickup" ? "Picked Up" : "Dropped Home";

    const guardianLabel = (data.guardian_name || "Parent").trim();
    const mobileDigits = digitsMobile(data.guardian_mobile);
    const hasSmsChannel = mobileDigits.length >= 10;

    const message = `🚌 *Student ${actionPast}*\n\nDear ${guardianLabel}, your child ${data.student_name} has been ${actionText} by Bus #${data.bus_number} (Driver: ${data.driver_name}) at ${data.time}.\n\n${data.action === "pickup" ? `📍 Pickup location: ${data.pickup_point}` : "✅ Home drop completed."}\n\n- Sishu Tirtha Safe Route`;

    const title = `Student ${actionPast}`;
    const shortBody = `${data.student_name} — Bus #${data.bus_number} · ${data.time}`;

    const whatsappPromise = hasSmsChannel
      ? supabase.functions.invoke("send-whatsapp-message", {
          body: {
            mobileNumber: data.guardian_mobile,
            message: { text: message },
          },
        })
      : Promise.resolve({ data: null, error: null });

    const smsPayload = hasSmsChannel
      ? { ...data, guardian_mobile: data.guardian_mobile!, guardian_name: guardianLabel }
      : null;
    const smsPromise = smsPayload
      ? supabase.functions.invoke("send-student-action-sms", {
          body: smsPayload,
        })
      : Promise.resolve({ data: null, error: null });

    const pushPromise = data.guardian_profile_id
      ? supabase.functions.invoke("send-push-notification", {
          body: {
            userId: data.guardian_profile_id,
            notification: {
              title,
              body: shortBody,
              icon: "/bus-icon.svg",
              badge: "/bus-icon.svg",
              data: {
                url: "/guardian/dashboard",
                action: data.action,
                step: data.action === "pickup" ? "student_pickup" : "student_drop",
                student: data.student_name,
                bus: data.bus_number,
              },
            },
          },
        })
      : Promise.resolve({ data: null, error: null });

    const [whatsappResult, smsResult, pushResult] = await Promise.allSettled([
      whatsappPromise,
      smsPromise,
      pushPromise,
    ]);

    if (hasSmsChannel) {
      if (whatsappResult.status === "fulfilled" && !whatsappResult.value.error) {
        console.log(`Student ${data.action} WhatsApp message sent to guardian: ${guardianLabel}`);
      } else {
        console.error(
          "Failed to send student action WhatsApp message:",
          whatsappResult.status === "fulfilled" ? whatsappResult.value.error : whatsappResult.reason,
        );
      }

      if (smsResult.status === "fulfilled" && !smsResult.value.error) {
        console.log(`Student ${data.action} SMS sent to guardian: ${guardianLabel}`);
      } else {
        console.error(
          "Failed to send student action SMS:",
          smsResult.status === "fulfilled" ? smsResult.value.error : smsResult.reason,
        );
      }
    } else {
      console.log(
        `Student ${data.action}: skipping SMS/WhatsApp (no mobile on record); push/in-app use profile id only.`,
      );
    }

    if (data.guardian_profile_id) {
      if (pushResult.status === "fulfilled" && !pushResult.value.error) {
        console.log(`Student ${data.action} push sent to guardian profile ${data.guardian_profile_id}`);
      } else if (pushResult.status === "fulfilled" && pushResult.value.error) {
        console.warn("Student action push failed:", pushResult.value.error);
      } else if (pushResult.status === "rejected") {
        console.warn("Student action push failed:", pushResult.reason);
      }
    } else {
      console.warn(
        `Student ${data.action}: no guardian_profile_id — guardian will not receive app push/in-app for this event.`,
      );
    }

    await logNotification({
      user_type: "guardian",
      title: `Student ${actionPast}`,
      body: message,
      mobile_number: data.guardian_mobile,
    });

  } catch (error) {
    console.error('Error sending student action notifications:', error);
    // Don't throw the error to avoid breaking the main flow
  }
};

export const sendWelcomeNotification = async (data: WelcomeNotificationData) => {
  try {
    let message: string;

    const pinLine =
      data.initial_portal_pin && /^\d{6}$/.test(data.initial_portal_pin)
        ? `\n🔐 Your login PIN: *${data.initial_portal_pin}* (keep it private)\n`
        : '\n';

    if (data.recipient_type === 'driver') {
      message = `🚌 *Welcome to Sishu Tirtha Safe Route!*\n\nHello ${data.name}! You have been added as a driver for Bus #${data.bus_number}.${pinLine}\n📱 Sign in with mobile ${data.mobile_number} and your 6-digit PIN. You can also use the driver QR from your admin for quick login.\n\n- Sishu Tirtha Safe Route Team`;
    } else {
      message = `🎉 *Your Child Has Been Enrolled!*\n\nDear ${data.name}, your child has been successfully enrolled in Sishu Tirtha Safe Route.\n\n🚌 Bus #${data.bus_number} will pick up your child from ${data.pickup_point}\n👨‍✈️ Driver: ${data.driver_name}${pinLine}\n📱 Sign in with this mobile number and your 6-digit PIN on the Guardian login page.\n\n- Sishu Tirtha Safe Route`;
    }

    // Send both WhatsApp and SMS notifications in parallel
    const [whatsappResult, smsResult] = await Promise.allSettled([
      // Send WhatsApp message
      supabase.functions.invoke('send-whatsapp-message', {
        body: {
          mobileNumber: data.mobile_number,
          message: {
            text: message
          }
        }
      }),
      // Send SMS
      supabase.functions.invoke('send-welcome-sms', {
        body: {
          mobileNumber: data.mobile_number,
          userName: data.name,
          userType: data.recipient_type
        }
      })
    ]);

    // Log WhatsApp result
    if (whatsappResult.status === 'fulfilled' && !whatsappResult.value.error) {
      console.log(`Welcome WhatsApp message sent to ${data.recipient_type}: ${data.name}`);
    } else {
      console.error('Failed to send welcome WhatsApp message:', whatsappResult.status === 'fulfilled' ? whatsappResult.value.error : whatsappResult.reason);
    }

    // Log SMS result
    if (smsResult.status === 'fulfilled' && !smsResult.value.error) {
      console.log(`Welcome SMS sent to ${data.recipient_type}: ${data.name}`);
    } else {
      console.error('Failed to send welcome SMS:', smsResult.status === 'fulfilled' ? smsResult.value.error : smsResult.reason);
    }

    // Log the notification in the database
    await logNotification({
      user_type: data.recipient_type,
      title: data.recipient_type === 'driver' ? 'Welcome Driver' : 'Child Enrolled',
      body: message,
      mobile_number: data.mobile_number
    });

  } catch (error) {
    console.error('Error sending welcome notifications:', error);
    // Don't throw the error to avoid breaking the main flow
  }
};

interface LogNotificationData {
  user_type: string;
  title: string;
  body: string;
  mobile_number?: string;
}

const logNotification = async (data: LogNotificationData) => {
  try {
    const { error } = await supabase
      .from('notification_logs')
      .insert([{
        user_type: data.user_type,
        title: data.title,
        body: data.body,
        tokens_sent: 1,
        fcm_response: { status: 'sent', mobile_number: data.mobile_number }
      }]);

    if (error) {
      console.error('Error logging notification:', error);
    }
  } catch (error) {
    console.error('Error logging notification:', error);
  }
};