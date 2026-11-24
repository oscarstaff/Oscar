'use strict';
/* pl-faq.js · Yatra · Pip FAQ questions and the help panel.
   One of the Yatra files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* ---------- Pip: fixed questions about using Yatra. No typing, no AI, nothing about Nexus rosters or hours. ---------- */
const NEXI_FAQ = [
  ['Getting around', [
    ['What is Yatra?', 'Yatra is where Oscars keeps track of leads and students: their enrolments, payments, First Aid bookings and placements. Rosters, clock-ins and leave are still in Nexus.', null],
    ['How do I find someone?', 'Type a name, email or phone number in the bar at the top and press Enter. Search covers leads and students together and labels each result.', ['#/search', 'Open search']],
    ['Where is the Admin tab?', 'Admin is only shown to hub admins. It holds the status lists, qualifications, agents and the two-step sign-in settings.', null],
    ['Why did Yatra lock me out?', 'Yatra locks after 15 minutes without activity, and your sign-in from Nexus lasts about an hour. Go back to Nexus and open Yatra again from the Nodes page.', null]
  ]],
  ['Leads and students', [
    ['What is the difference between a lead and a student?', 'Someone is a lead until their payments add up to $200. From $200 they are a student. Yatra moves them between the Leads and Students tabs by itself when a payment is added, matched or removed.', ['#/leads', 'Open Leads']],
    ['How do I add a new person?', 'Open Leads and press New lead. Everyone starts as a lead. Start with their phone number or email: if they are already in Yatra, their details fill in and you add to that person instead of making a duplicate.', ['#/leads?new=1', 'Add a lead']],
    ['How do I add an enrolment?', 'Open the person, then press Enrolment at the top of their page. One person can have several enrolments, each with its own qualification, fee and stage.', null],
    ['How do I change contact or personal details?', 'Open the person and use Edit contact, or Edit personal details under Personal and sensitive. Every look at the sensitive details and every change is logged.', null],
    ['How do I remove someone?', 'Only hub admins can archive or delete anything. If someone needs to go, ask a hub admin; archived people disappear from the lists but their records are kept.', null],
    ['Who can change a class booking?', 'Anyone can book a person into a class and mark Attended, No show, Cancelled or Rescheduled. Only the Evershine team (and hub admins) can change the flags on a booking: quiz sent, quiz done, paid, placement plan and signature.', null],
    ['Who can add or change payments?', 'Only the Processing and Accounts teams (and hub admins) can record a payment, link it to a student, or work the payment queue. Everyone else can see them.', null]
  ]],
  ['Payments', [
    ['How do I tick off documents someone has sent?', 'Open the person and go to the Enrolments and payments tab. The documents its course needs are listed right under each enrolment. Tick a document when you have received it. The tab title shows how many are still missing. Placement documents are on the Placement tab, and are not needed while the Placement status in the payment queue is Confirmed no PLC, PLC NYC or Placement Not Required.', ['#/students', 'Open Students']],
    ['How do I record a payment?', 'Open Payments and press Record payment. Type the phone or email of the student and their details and enrolment fill in. Or open the person, go to Enrolments and payments, and press Payment on the right enrolment.', ['#/payments', 'Open Payments']],
    ['What is an unmatched payment?', 'A payment that is not linked to a person yet. It does not count towards anyone’s $200 until you match it. The Unmatched view in Payments lists them.', ['#/payments?view=unmatched', 'Show unmatched']],
    ['How do refunds work?', 'Open the person, go to Enrolments and payments, and press Refund on the enrolment. The refund is recorded against that enrolment and shows in their history.', null],
    ['What do the payment statuses mean?', 'Each status and its meaning is listed in Admin under Status lists. Ask a hub admin if you cannot see that tab.', null]
  ]],
  ['First Aid and placement', [
    ['How do I book a First Aid seat?', 'Open First Aid, pick the class day, then press a free seat and choose the student. You can also press Book on the First Aid card on a person’s page.', ['#/firstaid', 'Open First Aid']],
    ['Where did the Follow-ups page go?', 'It is now the Task Manager tab, for general jobs: internal tasks and tasks about a student or lead. Give each task a priority, a due date and someone to do it. The 1st, 2nd and 3rd lead follow-ups moved to the Leads tab.', ['#/tasks', 'Open Task Manager']],
    ['How do I see which leads need their 1st, 2nd or 3rd follow-up?', 'Open Leads. Each lead has a Follow-up tag such as 2nd Follow Up Due (red when overdue). After the 3rd follow-up, a lead who has not booked a class and is not on hold or not interested stays in the cycle: when you press Done you pick the date of the next follow-up. Press 1st, 2nd or 3rd (or later) Follow Up Due above the list to show only those, or use the follow-up, assigned to and sort boxes. Sorting by follow-up due puts the most overdue first.', ['#/leads?fu=due', 'Open leads due a follow-up']],
    ['What do QS and PP mean?', 'They are the booking flags. QS quiz sent, PP placement plan (yes or done). The Evershine team can press a flag in the Class list to change it (it asks first), or tick several bookings and use the Mass flag setter.', null],
    ['How do I add a placement request or facility?', 'Open Placement, choose Self-Requests, Placements, Facilities or Blacklist, and press the New button at the top right. It changes to match the list you are on.', ['#/placement', 'Open Placement']],
    ['Where do the self-sought Google Form answers go?', 'Straight into Placement, Self-Requests, as a Not applied request tagged Google Form with the aged care details. If the student is not in Yatra yet, the name from the form shows with Not linked yet: press Link student once they are. Change the status from the list itself.', ['#/placement', 'Open Placement']]
  ]],
  ['Staff pages', [
    ['Where are my quizzes and documents?', 'Press More in the tab bar and choose Quizzes or Documents. They show the same quizzes and documents as Nexus. Quiz building and document upload are still done in Nexus.', ['#/quizzes', 'Open Quizzes']],
    ['How do I log a call?', 'Press More in the tab bar and choose Calls. Type the phone number first. If the person is already in Yatra their details fill in and the call is added to their Activity. If Yatra has never seen the number, logging the call starts an unfinished lead flagged to you. Tick “Not a student” for agents or facilities so no lead is made.', ['#/calls', 'Open Calls']],
    ['What is an unfinished lead?', 'A lead that was started from a call, so Yatra only has a name and a phone number. It shows an Unfinished tag in the Leads list and a banner on the record. Add the missing details, then press Mark complete.', ['#/leads?unf=mine', 'Leads flagged to me']],
    ['How do I record a logbook I received?', 'Press More in the tab bar and choose Logbook receipts. Type the student\u2019s name or email, check the date and who received it, add a comment if needed, and press Save receipt. Someone already in Yatra gets it on their Activity tab. A name Yatra does not know is saved by name only.', ['#/logbooks', 'Open Logbook receipts']],
    ['Where are the weekly conversion numbers?', 'Press More in the tab bar and choose Conversion report. Pick the dates (or This week, Last week) and Yatra works out the status counts, the pie chart, the follow-ups done by step and the class numbers. Use Print or save as PDF to share it. Outside Sydney comes from the tick on each person’s record.', ['#/convreport', 'Open Conversion report']],
    ['How do I fill in the team report?', 'Press More in the tab bar and choose Team report. Enter your numbers or tasks for the day and press Save entry. Team leads and admins can generate the weekly report and print it or save it as a PDF.', ['#/teamreport', 'Open Team report']],
    ['Where do I see team achievements?', 'Press More in the tab bar and choose Achievements. It lists who passed a training quiz, who earned Glow for a perfect fortnight and who reached a call milestone, the same feed as Nexus.', ['#/achievements', 'Open Achievements']],
    ['How do I change my photo, nickname or bio?', 'Press your name at the top right to open Profile. Your password, themes and notification settings are changed in Nexus.', ['#/profile', 'Open Profile']],
    ['How do I change how my name glows?', 'If you earned Glow (a perfect fortnight, or 1,000 logged calls), your name shimmers everywhere in Yatra. Open Profile and pick a style under Name glow. Nexus uses the same choice, so changing it in either place changes both.', ['#/profile', 'Open Profile']],
    ['How do I see someone else’s profile?', 'Press a name in Achievements (under More), or pick someone from the Team directory at the bottom of your Profile page. You see their team, what they are known for, their stats, bio and achievements.', ['#/achievements', 'Open Achievements']]
  ]]
];
function nexiInit() {
  if ($('#nexiFab')) return;
  const fab = document.createElement('button'); fab.id = 'nexiFab'; fab.type = 'button'; fab.className = 'nx-nexifab nx-noprint'; fab.setAttribute('aria-label', 'Ask Pip how to use Yatra'); fab.setAttribute('aria-expanded', 'false');
  fab.innerHTML = pipSVG();
  const panel = document.createElement('section'); panel.id = 'nexiPanel'; panel.className = 'nx-nexi nx-noprint'; panel.hidden = true; panel.setAttribute('aria-label', 'Pip help');
  document.body.appendChild(fab); document.body.appendChild(panel);
  const first = (ME.name || '').split(' ')[0];
  const home = () => {
    panel.innerHTML = '<header>' + pipSVG('pip-mini') + '<div><b>Hi' + (first ? ' ' + esc(first) : '') + ', I’m Pip</b><span>Pick a question about using Yatra.</span></div><button class="nx-btn icon quiet" data-x aria-label="Close help">' + ico('x') + '</button></header><div class="nx-nexibody">' +
      NEXI_FAQ.map((g, gi) => '<h4>' + esc(g[0]) + '</h4><div class="nx-nexiqs">' + g[1].map((q, qi) => '<button type="button" class="nx-chip" data-q="' + gi + '.' + qi + '">' + esc(q[0]) + '</button>').join('') + '</div>').join('') + '</div>';
    bind();
  };
  const answer = (gi, qi) => {
    const q = NEXI_FAQ[gi][1][qi];
    panel.innerHTML = '<header>' + pipSVG('pip-mini') + '<div><b>Pip</b><span>' + esc(NEXI_FAQ[gi][0]) + '</span></div><button class="nx-btn icon quiet" data-x aria-label="Close help">' + ico('x') + '</button></header><div class="nx-nexibody"><div class="nx-nexiq">' + esc(q[0]) + '</div><div class="nx-nexia" tabindex="-1">' + esc(q[1]) + '</div><div class="nx-btnrow" style="margin-top:14px">' + (q[2] ? '<a class="nx-btn primary sm" data-go href="' + esc(q[2][0]) + '">' + esc(q[2][1]) + '</a>' : '') + '<button type="button" class="nx-btn sm" data-back>All questions</button></div></div>';
    bind(); const a = $('.nx-nexia', panel); if (a) a.focus();
  };
  const close = () => { if (panel.hidden) return; panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); fab.focus(); };
  const bind = () => {
    $('[data-x]', panel).onclick = close;
    $$('[data-q]', panel).forEach(b => b.onclick = () => { const p = b.dataset.q.split('.'); answer(+p[0], +p[1]); });
    const bk = $('[data-back]', panel); if (bk) bk.onclick = () => { home(); const f = $('.nx-chip', panel); if (f) f.focus(); };
    const go = $('[data-go]', panel); if (go) go.onclick = () => { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); };
  };
  fab.onclick = () => { if (!panel.hidden) return close(); home(); panel.hidden = false; fab.setAttribute('aria-expanded', 'true'); const f = $('.nx-chip', panel); if (f) f.focus(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden && !modalStack.length) { e.stopPropagation(); close(); } });
  document.addEventListener('pointerdown', e => { if (!panel.hidden && !panel.contains(e.target) && !fab.contains(e.target)) { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); } });
  pipLife(fab, panel, first);
}
