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
