export function assignedEmail({ title, clientName, due, appUrl }) {
  return {
    subject: `Assigned: ${title}`,
    text: [
      `You've been assigned a design request.`,
      ``,
      `Title: ${title}`,
      `Client: ${clientName}`,
      due ? `Due: ${due}` : "",
      ``,
      appUrl ? `Open in Keel: ${appUrl}` : "",
    ].filter(Boolean).join("\n"),
  };
}

export function rushPoolEmail({ title, priority, clientName, appUrl }) {
  return {
    subject: `New ${priority} request in pool: ${title}`,
    text: [
      `A new ${priority} design request is available in the unassigned pool.`,
      ``,
      `Title: ${title}`,
      `Client: ${clientName}`,
      ``,
      appUrl ? `Claim in Keel: ${appUrl}` : "",
    ].join("\n"),
  };
}

export function claimedEmail({ title, appUrl }) {
  return {
    subject: `You claimed: ${title}`,
    text: [
      `You successfully claimed this design request.`,
      ``,
      `Title: ${title}`,
      ``,
      appUrl ? `Open in Keel: ${appUrl}` : "",
    ].join("\n"),
  };
}

export function commentEmail({ title, authorName, clientName, excerpt, appUrl }) {
  return {
    subject: `${clientName || "Client"} commented on ${title}`,
    text: [
      `${authorName} left a comment on "${title}".`,
      excerpt ? `\n"${excerpt}"` : "",
      ``,
      appUrl ? `View in Keel: ${appUrl}` : "",
    ].join("\n"),
  };
}

export function proofReadyEmail({ title, clientName, appUrl }) {
  return {
    subject: `Proof ready: ${title}`,
    text: [
      `A new proof is ready for your review.`,
      ``,
      `Title: ${title}`,
      `Client: ${clientName}`,
      ``,
      appUrl ? `Review in Keel: ${appUrl}` : "",
    ].join("\n"),
  };
}

export function dueReminderEmail({ title, due, appUrl }) {
  return {
    subject: `Reminder: ${title} due ${due}`,
    text: [
      `This design request is due soon.`,
      ``,
      `Title: ${title}`,
      `Due: ${due}`,
      ``,
      appUrl ? `Open in Keel: ${appUrl}` : "",
    ].join("\n"),
  };
}

export function inviteEmail({
  name,
  roleLabel,
  roleDescription,
  keelOverview,
  clientName,
  invitedBy,
  inviteUrl,
  alternateInviteUrls,
  expiresAt,
}) {
  const expiry = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const lines = [
    `Hi ${name || "there"},`,
    ``,
    invitedBy
      ? `${invitedBy} invited you to join Keel — the workspace for Fog Signal Strategies.`
      : `You've been invited to join Keel — the workspace for Fog Signal Strategies.`,
    ``,
    `WHAT IS KEEL`,
    ...(keelOverview || []).map((line) => `• ${line}`),
    ``,
    `YOUR ROLE: ${roleLabel}`,
    ...(roleDescription || []).map((line) => `• ${line}`),
  ];

  if (clientName) {
    lines.push(``, `Client account: ${clientName}`);
  }

  lines.push(
    ``,
    `Create your account and set a password using the link below:`,
    inviteUrl || "",
  );

  if (alternateInviteUrls?.length) {
    lines.push(
      ``,
      `Keel is also available at:`,
      ...alternateInviteUrls,
    );
  }

  lines.push(
    ``,
    expiry ? `This link expires on ${expiry}.` : "",
    ``,
    `If you weren't expecting this invitation, you can ignore this email.`,
    ``,
    `— Fog Signal Strategies`,
  );

  return {
    subject: `You're invited to Keel (${roleLabel})`,
    text: lines.filter((line) => line !== "").join("\n"),
  };
}
