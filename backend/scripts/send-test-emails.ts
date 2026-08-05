// One-off: sends one sample of each of the 8 redesigned transactional email
// types to a review address, using representative sample data (no real user
// data touched, no DB writes). Delete this file once the redesign is signed
// off — it exists purely so the recipient can eyeball all 8 templates.
//
// Usage: npx tsx scripts/send-test-emails.ts [to-address]

import "dotenv/config";
import { config } from "../src/config.js";
import {
  sendMail,
  isMailerConfigured,
  wrapEmail,
  emailParagraphs,
  emailCodeBox,
  emailInfoBox,
  emailNoteBox,
  emailButton,
  escapeHtml,
} from "../src/services/mailer.service.js";

const TO = process.argv[2] || "kartikjarali@gmail.com";

async function main() {
  if (!isMailerConfigured()) {
    console.error("SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS) — aborting.");
    process.exit(1);
  }
  console.log(`Sending 8 sample emails to ${TO} …`);

  // 1. Admin password reset code
  {
    const code = "482913";
    const text = `Your Contralyne admin password reset code is: ${code}\n\nIt expires in 15 minutes. If you did not request this, you can ignore this email.`;
    const html = wrapEmail(
      `${emailParagraphs("Hi,\n\nUse this code to reset your Contralyne admin password:")}
       ${emailCodeBox(code)}
       ${emailParagraphs("It expires in 15 minutes. If you did not request this, you can safely ignore this email.")}`,
      { preheader: `Your password reset code is ${code}` },
    );
    await sendMail(TO, "[Sample 1/8] Contralyne admin password reset", text, { html });
    console.log("✓ 1/8 admin password reset");
  }

  // 2. Super admin sign-in OTP
  {
    const code = "715260";
    const text = `Your Contralyne super admin sign-in code is: ${code}\n\nIt expires in 15 minutes. If you did not request this, you can ignore this email.`;
    const html = wrapEmail(
      `${emailParagraphs("Hi,\n\nUse this code to sign in to Contralyne Super Admin:")}
       ${emailCodeBox(code)}
       ${emailParagraphs("It expires in 15 minutes. If you did not request this, you can safely ignore this email.")}`,
      { preheader: `Your sign-in code is ${code}` },
    );
    await sendMail(TO, "[Sample 2/8] Your Contralyne sign-in code", text, { html });
    console.log("✓ 2/8 super admin sign-in code");
  }

  // 3. Landing-page contact form enquiry
  {
    const name = "Jordan Ellis";
    const email = "jordan@ellislawgroup.com";
    const firm = "Ellis Law Group";
    const team_size = "6-15";
    const message =
      "Hi — we're a mid-sized firm doing a lot of SaaS and vendor contract review. Could we get a quick demo this week? Also curious how pricing works for a 10-seat team.";
    const text = `New enquiry from the Contralyne landing page:

Name:       ${name}
Work email: ${email}
Firm:       ${firm}
Team size:  ${team_size}

Message:
${message}

—
Reply directly to this email to respond to ${name}.`;
    const html = wrapEmail(
      `${emailParagraphs("New enquiry from the Contralyne landing page:")}
       ${emailInfoBox([
         { label: "Name", value: name },
         { label: "Work email", value: email },
         { label: "Firm", value: firm },
         { label: "Team size", value: team_size },
       ])}
       ${emailNoteBox(message, { label: "Message" })}
       ${emailParagraphs(`Reply directly to this email to respond to ${name}.`)}`,
      { preheader: `New enquiry from ${name} at ${firm}` },
    );
    await sendMail(TO, `[Sample 3/8] Contralyne enquiry — ${firm} (${name})`, text, { replyTo: email, html });
    console.log("✓ 3/8 contact form enquiry");
  }

  // 4. Obligation reminder (upcoming)
  {
    const title = "Q3 board update";
    const contractName = "MSA — Northwind Logistics.pdf";
    const dueDateStr = new Date(Date.now() + 3 * 86400000).toDateString();
    const url = `${config.WEB_URL}/contracts/`;
    const text = `Hi,

This is coming up:

Board update: ${title}
Contract:  ${contractName}
Due date:  ${dueDateStr}

View it on Contralyne: ${url}

— The Contralyne Team`;
    const html = wrapEmail(
      `${emailParagraphs("Hi,\n\nThis obligation is coming up:")}
       ${emailInfoBox([
         { label: "Obligation", value: `Board update: ${title}` },
         { label: "Contract", value: contractName },
         { label: "Due date", value: dueDateStr },
       ])}
       ${emailButton(url, "View on Contralyne")}`,
      { preheader: `Due: ${title} — ${dueDateStr}` },
    );
    await sendMail(TO, `[Sample 4/8] Reminder: ${title} — due ${dueDateStr}`, text, { html });
    console.log("✓ 4/8 obligation reminder");
  }

  // 5. Approval requested
  {
    const approverName = "Priya Nair";
    const contractName = "Vendor Agreement — Skyline Cloud Services.docx";
    const url = `${config.WEB_URL}/contracts/sample-id`;
    const tasksUrl = `${config.WEB_URL}/tasks`;
    const text = `Hi ${approverName},\n\nThe contract "${contractName}" is pending your approval on Contralyne.\n\nReview it here: ${url}\n\nThis has also been added to your task list: ${tasksUrl}\n\n— Contralyne`;
    const html = wrapEmail(
      `${emailParagraphs(`Hi ${approverName},\n\nThe contract below is pending your approval on Contralyne.`)}
       ${emailInfoBox([{ label: "Contract", value: contractName }])}
       ${emailButton(url, "Review contract")}
       <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">This has also been added to your <a href="${tasksUrl}" style="color:#00BFA6;font-weight:600;text-decoration:none;">task list</a>.</p>`,
      { preheader: `"${contractName}" is pending your approval` },
    );
    await sendMail(TO, `[Sample 5/8] Approval requested: ${contractName}`, text, { html });
    console.log("✓ 5/8 approval requested");
  }

  // 6. Welcome / account ready
  {
    const first_name = "Alex";
    const email = "alex@examplefirm.com";
    const greeting = `Hi ${first_name},`;
    const signInUrl = `${config.WEB_URL}/sign-in`;
    const text = `${greeting}

An account has been created for you on Contralyne, the AI contract review platform.

To log in for the first time:

1. Open ${signInUrl}
2. Click "Forgot password?"
3. Enter this email address: ${email}
4. Check your inbox for a verification code and enter it
5. Choose a new password
6. Sign in with your email and new password

That's it — you're in. If you have any trouble logging in, reply to this email or contact support@contralyne.com.

— The Contralyne Team`;
    const html = wrapEmail(
      `${emailParagraphs(`${greeting}\n\nAn account has been created for you on Contralyne, the AI contract review platform.`)}
       <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280;">First-time login</p>
       <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
         ${[
           "Open the sign-in page",
           `Click "Forgot password?"`,
           `Enter this email address: ${email}`,
           "Check your inbox for a verification code and enter it",
           "Choose a new password",
           "Sign in with your email and new password",
         ]
           .map(
             (step, i) => `
         <tr>
           <td valign="top" style="padding:5px 10px 5px 0;">
             <span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:#D9FAF4;color:#0F2A2A;font-size:11px;font-weight:700;text-align:center;line-height:20px;">${i + 1}</span>
           </td>
           <td style="padding:5px 0;font-size:13.5px;line-height:1.5;color:#1f2937;">${escapeHtml(step)}</td>
         </tr>`,
           )
           .join("")}
       </table>
       ${emailButton(signInUrl, "Sign in to Contralyne")}
       ${emailParagraphs("That's it — you're in. If you have any trouble logging in, reply to this email or contact support@contralyne.com.")}`,
      { preheader: "Your Contralyne account is ready — here's how to log in" },
    );
    await sendMail(TO, "[Sample 6/8] Your Contralyne account is ready", text, { html });
    console.log("✓ 6/8 welcome / account ready");
  }

  // 7. Support ticket resolved
  {
    const type = "clause_change";
    const reference_name = "Limitation of Liability clause";
    const created_at = new Date(Date.now() - 4 * 86400000).toISOString();
    const description = "Our standard liability cap should be 12 months' fees, not 6 — can this be updated in the playbook?";
    const admin_notes = "Updated the Limitation of Liability fallback clause to a 12-month fees cap. It'll apply to all new analyses going forward.";
    const subjectRef = ` — ${reference_name}`;
    const signInUrl = `${config.WEB_URL}/sign-in`;
    const text = `Hi,

Good news — your support ticket on Contralyne has been resolved by our team.

Ticket details:
Type:      ${type}
Regarding: ${reference_name}
Raised on: ${new Date(created_at).toDateString()}

Your request:
${description}

Note from our team:
${admin_notes}

You can log in at ${signInUrl} to continue where you left off.

If the issue isn't fully fixed, just reply to this email and we'll take another look.

— The Contralyne Team`;
    const html = wrapEmail(
      `${emailParagraphs("Hi,\n\nGood news — your support ticket on Contralyne has been resolved by our team.")}
       ${emailInfoBox(
         [
           { label: "Type", value: type },
           { label: "Regarding", value: reference_name },
           { label: "Raised on", value: new Date(created_at).toDateString() },
         ],
         { title: "Ticket details" },
       )}
       ${emailNoteBox(description, { label: "Your request" })}
       ${emailNoteBox(admin_notes, { label: "Note from our team" })}
       ${emailButton(signInUrl, "Sign in to Contralyne")}
       ${emailParagraphs("If the issue isn't fully fixed, just reply to this email and we'll take another look.")}`,
      { preheader: `Your ticket${subjectRef} has been resolved` },
    );
    await sendMail(TO, `[Sample 7/8] Your Contralyne support ticket has been resolved${subjectRef}`, text, { html });
    console.log("✓ 7/8 ticket resolved");
  }

  // 8. Task assigned
  {
    const title = "Review redlines on Skyline MSA";
    const priority = "high";
    const dueStr = new Date(Date.now() + 2 * 86400000).toDateString();
    const notes = "Counterparty pushed back on the indemnity cap — take a look before Thursday's call.";
    const attachmentFilename = "Skyline_MSA_v3_redlined.docx";
    const tasksUrl = `${config.WEB_URL}/tasks`;
    const text = `Hi,

A new task has been assigned to you on Contralyne:

Task:      ${title}
Priority:  ${priority}
Due date:  ${dueStr}
Attached document: ${attachmentFilename} — download it from your Tasks page.

Details:
${notes}

View your tasks: ${tasksUrl}

— The Contralyne Team`;
    const html = wrapEmail(
      `${emailParagraphs("Hi,\n\nA new task has been assigned to you on Contralyne:")}
       ${emailInfoBox([
         { label: "Task", value: title },
         { label: "Priority", value: priority },
         { label: "Due date", value: dueStr },
         { label: "Attachment", value: attachmentFilename },
       ])}
       ${emailNoteBox(notes, { label: "Details" })}
       ${emailButton(tasksUrl, "View your tasks")}`,
      { preheader: `New task: ${title}` },
    );
    await sendMail(TO, `[Sample 8/8] New task assigned to you: ${title}`, text, { html });
    console.log("✓ 8/8 task assigned");
  }

  console.log("Done — all 8 sample emails sent to", TO);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
