/**
 * FreightWizard Gmail Add-on v3.0
 * Queue-based architecture - instant UI
 */

var CONFIG = {
  API_URL: 'https://freightwizard-production.up.railway.app'
};

// ===========================================
// ENTRY POINTS
// ===========================================

function onHomepage(e) {
  var card = CardService.newCardBuilder();
  card.setHeader(
    CardService.newCardHeader()
      .setTitle('FreightWizard')
      .setSubtitle('AI Freight Assistant')
  );

  var section = CardService.newCardSection();
  section.addWidget(
    CardService.newTextParagraph()
      .setText('👋 Welcome to FreightWizard!\n\nOpen an email to analyze it with AI.')
  );
  section.addWidget(
    CardService.newTextButton()
      .setText('🔍 Analyze Recent (5 emails)')
      .setOnClickAction(CardService.newAction().setFunctionName('analyzeRecentEmails'))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
  );
  section.addWidget(
    CardService.newTextButton()
      .setText('📧 Analyze All Unread')
      .setOnClickAction(CardService.newAction().setFunctionName('analyzeAllUnread'))
  );
  card.addSection(section);
  return card.build();
}

function onGmailMessage(e) {
  if (!e || !e.gmail || !e.gmail.messageId) return onHomepage(e);

  var messageId = e.gmail.messageId;
  var accessToken = e.gmail.accessToken;
  GmailApp.setCurrentMessageAccessToken(accessToken);

  var cache = CacheService.getUserCache();
  var cachedData = cache.get('fw_' + messageId);

  if (cachedData) {
    var analysis = JSON.parse(cachedData);
    var message = GmailApp.getMessageById(messageId);
    var thread = message.getThread();
    applyAutoLabels(messageId, analysis);
    return buildEmailCard(message, thread, analysis);
  }

  var dbResult = checkAnalysisResult(messageId);

  if (dbResult && dbResult.status === 'ready') {
    cache.put('fw_' + messageId, JSON.stringify(dbResult.analysis), 3600);
    if (dbResult.analysis.suggested_reply) {
      cache.put('reply_' + messageId, dbResult.analysis.suggested_reply, 3600);
    }
    var message = GmailApp.getMessageById(messageId);
    var thread = message.getThread();
    applyAutoLabels(messageId, dbResult.analysis);
    return buildEmailCard(message, thread, dbResult.analysis);
  }

  var message = GmailApp.getMessageById(messageId);
  var thread = message.getThread();
  var subject = message.getSubject() || '';
  var from = message.getFrom() || '';
  var body = message.getPlainBody() || '';

  queueAnalysis(messageId, subject, from, body, thread.getId());

  if (dbResult && dbResult.status === 'processing') {
    return buildProcessingCard(messageId, subject, from, body, thread.getId());
  }

  return buildQuickCard(messageId, subject, from, body, thread.getId());
}

// ===========================================
// API CALLS
// ===========================================

// Every API request proves who the user is with a Google ID token, which the
// API verifies with Google. The API no longer accepts a plain userEmail.
// Needs the "openid" and "userinfo.email" scopes (appsscript.json).
function apiFetch(path, options) {
  options = options || {};
  options.headers = options.headers || {};
  options.headers['Authorization'] = 'Bearer ' + ScriptApp.getIdentityToken();
  options.muteHttpExceptions = true;
  return UrlFetchApp.fetch(CONFIG.API_URL + path, options);
}

// Run once from the Apps Script editor to read the add-on's OAuth client ID
// (the token's "aud"), which goes into GOOGLE_ADDON_CLIENT_IDS on Railway.
function showIdentityTokenAudience() {
  var payload = ScriptApp.getIdentityToken().split('.')[1];
  var json = Utilities.newBlob(Utilities.base64DecodeWebSafe(payload + '==='.slice((payload.length + 3) % 4))).getDataAsString();
  var claims = JSON.parse(json);
  Logger.log('GOOGLE_ADDON_CLIENT_IDS = ' + claims.aud + '   (token email: ' + claims.email + ')');
}

function checkAnalysisResult(messageId) {
  try {
    var response = apiFetch('/api/analysis-result?emailId=' + encodeURIComponent(messageId));
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    }
    return null;
  } catch (err) {
    Logger.log('Check result error: ' + err);
    return null;
  }
}

function queueAnalysis(messageId, subject, from, body, threadId) {
  try {
    var payload = {
      'emailId': messageId,
      'subject': subject,
      'from': from,
      'body': body.substring(0, 4000),
      'threadId': threadId
    };
    var options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(payload)
    };
    var response = apiFetch('/api/queue-analysis', options);
    if (response.getResponseCode() === 200) {
      var result = JSON.parse(response.getContentText());
      if (result.status === 'ready' && result.analysis) {
        var cache = CacheService.getUserCache();
        cache.put('fw_' + messageId, JSON.stringify(result.analysis), 3600);
        if (result.analysis.suggested_reply) {
          cache.put('reply_' + messageId, result.analysis.suggested_reply, 3600);
        }
        applyAutoLabels(messageId, result.analysis);
      }
    }
  } catch (err) {
    Logger.log('Queue error: ' + err);
  }
}

// ===========================================
// CARD BUILDERS
// ===========================================

function buildQuickCard(messageId, subject, from, body, threadId) {
  var card = CardService.newCardBuilder();
  card.setHeader(
    CardService.newCardHeader()
      .setTitle('FreightWizard')
      .setSubtitle('AI Freight Assistant')
  );

  var section = CardService.newCardSection().setHeader('🤖 AI Analysis');
  section.addWidget(CardService.newDecoratedText().setTopLabel('Subject').setText(subject.substring(0, 50)));
  section.addWidget(CardService.newDecoratedText().setTopLabel('From').setText(from.substring(0, 40)));
  section.addWidget(CardService.newTextParagraph().setText('⚡ Queued for analysis!\n\nClick "Check Result" in a few seconds.'));

  section.addWidget(
    CardService.newTextButton()
      .setText('🔄 Check Result')
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName('doCheckResult')
          .setParameters({'msgId': messageId, 'subj': subject, 'from': from, 'body': body.substring(0, 4000), 'threadId': threadId})
      )
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
  );

  section.addWidget(
    CardService.newTextButton()
      .setText('✨ Analyze Now')
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName('doAnalyzeFromContext')
          .setParameters({'msgId': messageId, 'subj': subject, 'from': from, 'body': body.substring(0, 4000), 'threadId': threadId})
      )
  );

  card.addSection(section);
  card.addSection(buildLabelSection(messageId));
  return card.build();
}

function buildProcessingCard(messageId, subject, from, body, threadId) {
  var card = CardService.newCardBuilder();
  card.setHeader(
    CardService.newCardHeader()
      .setTitle('FreightWizard')
      .setSubtitle('AI Freight Assistant')
  );

  var section = CardService.newCardSection().setHeader('⏳ Processing...');
  section.addWidget(CardService.newTextParagraph().setText('AI is analyzing this email.\n\nClick "Check Result" in a few seconds.'));
  section.addWidget(
    CardService.newTextButton()
      .setText('🔄 Check Result')
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName('doCheckResult')
          .setParameters({'msgId': messageId, 'subj': subject, 'from': from, 'body': (body || '').substring(0, 4000), 'threadId': threadId || ''})
      )
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
  );
  card.addSection(section);
  card.addSection(buildLabelSection(messageId));
  return card.build();
}

function buildEmailCard(message, thread, analysis) {
  var card = CardService.newCardBuilder();
  var subject = message.getSubject() || '(No Subject)';
  var from = message.getFrom() || '';
  var body = message.getPlainBody() || '';
  var messageId = message.getId();
  var threadId = thread.getId();

  card.setHeader(
    CardService.newCardHeader()
      .setTitle('FreightWizard')
      .setSubtitle('AI Freight Assistant')
  );

  var priorityEmoji = {'urgent': '🔴', 'high': '🟠', 'medium': '🟡', 'low': '🟢'};
  var pIcon = priorityEmoji[String(analysis.priority || '').toLowerCase()] || '⚪';

  var summarySection = CardService.newCardSection().setHeader('🧠 AI Summary');
  summarySection.addWidget(CardService.newDecoratedText().setTopLabel('Intent').setText(String(analysis.intent || '').replace(/_/g, ' ')));
  summarySection.addWidget(CardService.newDecoratedText().setTopLabel('Priority').setText(pIcon + ' ' + String(analysis.priority || '').toUpperCase()));
  if (analysis.pol || analysis.pod) {
    summarySection.addWidget(CardService.newDecoratedText().setTopLabel('Route').setText((analysis.pol || '?') + ' → ' + (analysis.pod || '?')));
  }
  if (analysis.summary) {
    summarySection.addWidget(CardService.newTextParagraph().setText(String(analysis.summary).substring(0, 250)));
  }
  card.addSection(summarySection);

  var shipSection = CardService.newCardSection().setHeader('📦 Shipment Data');
  var hasData = false;
  if (analysis.mode) { shipSection.addWidget(CardService.newDecoratedText().setTopLabel('Mode').setText(String(analysis.mode))); hasData = true; }
  if (analysis.pol) { shipSection.addWidget(CardService.newDecoratedText().setTopLabel('POL').setText(String(analysis.pol))); hasData = true; }
  if (analysis.pod) { shipSection.addWidget(CardService.newDecoratedText().setTopLabel('POD').setText(String(analysis.pod))); hasData = true; }
  if (analysis.incoterm) { shipSection.addWidget(CardService.newDecoratedText().setTopLabel('Incoterm').setText(String(analysis.incoterm))); hasData = true; }
  if (analysis.container_type) {
    var ct = (analysis.container_count ? analysis.container_count + 'x ' : '') + String(analysis.container_type);
    shipSection.addWidget(CardService.newDecoratedText().setTopLabel('Container').setText(ct));
    hasData = true;
  }
  if (analysis.cargo_type) { shipSection.addWidget(CardService.newDecoratedText().setTopLabel('Cargo').setText(String(analysis.cargo_type))); hasData = true; }
  if (!hasData) shipSection.addWidget(CardService.newTextParagraph().setText('No shipment data detected.'));
  card.addSection(shipSection);

  if (analysis.missing_info && analysis.missing_info.length > 0) {
    var missingSection = CardService.newCardSection().setHeader('⚠️ Missing Info');
    missingSection.addWidget(CardService.newTextParagraph().setText(analysis.missing_info.map(function(i) { return '• ' + i; }).join('\n')));
    missingSection.addWidget(
      CardService.newTextButton()
        .setText('❓ Request Missing Info')
        .setOnClickAction(CardService.newAction().setFunctionName('doRequestMissingInfo').setParameters({'msgId': messageId, 'to': from, 'subj': subject, 'missing': JSON.stringify(analysis.missing_info)}))
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    );
    card.addSection(missingSection);
  }

  var actionsSection = CardService.newCardSection().setHeader('⚡ Actions');
  if (analysis.suggested_reply) {
    var cache = CacheService.getUserCache();
    cache.put('reply_' + messageId, analysis.suggested_reply, 3600);
    actionsSection.addWidget(
      CardService.newTextButton()
        .setText('📝 Insert Reply as Draft')
        .setOnClickAction(CardService.newAction().setFunctionName('doInsertDraft').setParameters({'msgId': messageId, 'to': from, 'subj': subject, 'threadId': threadId}))
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    );
    actionsSection.addWidget(
      CardService.newTextButton()
        .setText('✉️ Send Reply Now')
        .setOnClickAction(CardService.newAction().setFunctionName('doSendReply').setParameters({'msgId': messageId, 'to': from, 'subj': subject}))
    );
  }
  actionsSection.addWidget(
    CardService.newTextButton()
      .setText('🔁 Generate Follow-up')
      .setOnClickAction(CardService.newAction().setFunctionName('doGenerateFollowup').setParameters({'msgId': messageId, 'to': from, 'subj': subject, 'body': body.substring(0, 500)}))
  );
  actionsSection.addWidget(
    CardService.newTextButton()
      .setText('🔄 Re-analyze')
      .setOnClickAction(CardService.newAction().setFunctionName('doAnalyzeFromContext').setParameters({'msgId': messageId, 'subj': subject, 'from': from, 'body': body.substring(0, 4000), 'threadId': threadId}))
  );
  card.addSection(actionsSection);
  card.addSection(buildLabelSection(messageId));
  return card.build();
}

function buildLabelSection(messageId) {
  var labelSection = CardService.newCardSection().setHeader('🏷️ Quick Labels');
  labelSection.addWidget(
    CardService.newButtonSet()
      .addButton(CardService.newTextButton().setText('🔴 Urgent').setOnClickAction(CardService.newAction().setFunctionName('labelUrgent').setParameters({'msgId': messageId})))
      .addButton(CardService.newTextButton().setText('🟠 High').setOnClickAction(CardService.newAction().setFunctionName('labelHigh').setParameters({'msgId': messageId})))
      .addButton(CardService.newTextButton().setText('🟡 Medium').setOnClickAction(CardService.newAction().setFunctionName('labelMedium').setParameters({'msgId': messageId})))
      .addButton(CardService.newTextButton().setText('🟢 Low').setOnClickAction(CardService.newAction().setFunctionName('labelLow').setParameters({'msgId': messageId})))
  );
  return labelSection;
}

// ===========================================
// CHECK RESULT
// ===========================================

function doCheckResult(e) {
  var p = e.parameters;
  var messageId = p.msgId;
  var result = checkAnalysisResult(messageId);

  if (result && result.status === 'ready') {
    var cache = CacheService.getUserCache();
    cache.put('fw_' + messageId, JSON.stringify(result.analysis), 3600);
    if (result.analysis.suggested_reply) cache.put('reply_' + messageId, result.analysis.suggested_reply, 3600);
    applyAutoLabels(messageId, result.analysis);
    var message = GmailApp.getMessageById(messageId);
    var thread = message.getThread();
    var newCard = buildEmailCard(message, thread, result.analysis);
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('✅ Analysis ready!'))
      .setNavigation(CardService.newNavigation().updateCard(newCard))
      .build();
  }

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('⏳ Still processing... try again in a moment.'))
    .build();
}

// ===========================================
// ANALYZE DIRECT
// ===========================================

function doAnalyzeFromContext(e) {
  var p = e.parameters;
  var messageId = p.msgId;
  try {
    var payload = {
      'subject': p.subj, 'body': p.body, 'from': p.from,
      'emailId': messageId, 'threadId': p.threadId,
      'source': 'gmail_addon'
    };
    var options = {'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(payload)};
    var response = apiFetch('/api/analyze', options);
    if (response.getResponseCode() === 200) {
      var result = JSON.parse(response.getContentText());
      var analysis = result.analysis;
      var cache = CacheService.getUserCache();
      cache.put('fw_' + messageId, JSON.stringify(analysis), 3600);
      if (analysis.suggested_reply) cache.put('reply_' + messageId, analysis.suggested_reply, 3600);
      applyAutoLabels(messageId, analysis);
      var message = GmailApp.getMessageById(messageId);
      var thread = message.getThread();
      var newCard = buildEmailCard(message, thread, analysis);
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText('✅ Analysis complete!'))
        .setNavigation(CardService.newNavigation().updateCard(newCard))
        .build();
    } else {
      throw new Error('API error ' + response.getResponseCode());
    }
  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('❌ Error: ' + err.message))
      .build();
  }
}

// ===========================================
// INSERT DRAFT
// ===========================================

function doInsertDraft(e) {
  var p = e.parameters;
  try {
    var cache = CacheService.getUserCache();
    var reply = cache.get('reply_' + p.msgId);
    if (!reply) return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('❌ No reply found. Re-analyze first.')).build();
    var to = p.to; var match = to.match(/<(.+?)>/); if (match) to = match[1];
    var subject = p.subj; if (!subject.startsWith('Re:')) subject = 'Re: ' + subject;
    GmailApp.createDraft(to, subject, reply);
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('📝 Draft created! Check your Drafts folder.')).build();
  } catch (err) {
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('❌ Failed: ' + err.message)).build();
  }
}

// ===========================================
// SEND REPLY
// ===========================================

function doSendReply(e) {
  var p = e.parameters;
  try {
    var cache = CacheService.getUserCache();
    var reply = cache.get('reply_' + p.msgId);
    if (!reply) return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('❌ No reply found. Analyze first.')).build();
    var to = p.to; var match = to.match(/<(.+?)>/); if (match) to = match[1];
    var subject = p.subj; if (!subject.startsWith('Re:')) subject = 'Re: ' + subject;
    GmailApp.sendEmail(to, subject, reply);
    trackReply(p.msgId, reply);
    addRepliedLabel(p.msgId);
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('✅ Reply sent!')).build();
  } catch (err) {
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('❌ Failed: ' + err.message)).build();
  }
}

// ===========================================
// REQUEST MISSING INFO
// ===========================================

function doRequestMissingInfo(e) {
  var p = e.parameters;
  try {
    var missing = JSON.parse(p.missing);
    var to = p.to; var match = to.match(/<(.+?)>/); if (match) to = match[1];
    var subject = p.subj; if (!subject.startsWith('Re:')) subject = 'Re: ' + subject;
    var missingList = missing.map(function(item) { return '- ' + item; }).join('\n');
    var reply = 'Dear Sir/Madam,\n\nThank you for your inquiry. To proceed, please provide:\n\n' + missingList + '\n\nBest regards,\nFreight Team';
    GmailApp.createDraft(to, subject, reply);
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('📝 Missing info request saved as draft!')).build();
  } catch (err) {
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('❌ Failed: ' + err.message)).build();
  }
}

// ===========================================
// FOLLOW-UP
// ===========================================

function doGenerateFollowup(e) {
  var p = e.parameters;
  try {
    var to = p.to; var match = to.match(/<(.+?)>/); if (match) to = match[1];
    var subject = p.subj; if (!subject.startsWith('Re:')) subject = 'Re: ' + subject;
    var followup = 'Dear Sir/Madam,\n\nI hope this email finds you well. I wanted to follow up on my previous message regarding "' + p.subj + '".\n\nCould you please provide an update on the status of this request?\n\nThank you.\n\nBest regards,\nFreight Team';
    GmailApp.createDraft(to, subject, followup);
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('🔁 Follow-up saved as draft!')).build();
  } catch (err) {
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('❌ Failed: ' + err.message)).build();
  }
}

// ===========================================
// BATCH ANALYZE
// ===========================================

function analyzeRecentEmails(e) {
  try {
    var threads = GmailApp.getInboxThreads(0, 5);
    var count = 0;
    for (var i = 0; i < threads.length; i++) {
      var messages = threads[i].getMessages();
      var msg = messages[messages.length - 1];
      queueAnalysis(msg.getId(), msg.getSubject() || '', msg.getFrom() || '', (msg.getPlainBody() || '').substring(0, 4000), threads[i].getId());
      count++;
    }
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('⚡ ' + count + ' emails queued! Open each email to see results.')).build();
  } catch (err) {
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('❌ Error: ' + err.message)).build();
  }
}

function analyzeAllUnread(e) {
  try {
    var threads = GmailApp.search('is:unread in:inbox', 0, 10);
    var count = 0;
    for (var i = 0; i < threads.length; i++) {
      var messages = threads[i].getMessages();
      var msg = messages[messages.length - 1];
      queueAnalysis(msg.getId(), msg.getSubject() || '', msg.getFrom() || '', (msg.getPlainBody() || '').substring(0, 4000), threads[i].getId());
      count++;
      if (count >= 10) break;
    }
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('⚡ ' + count + ' emails queued!')).build();
  } catch (err) {
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('❌ Error: ' + err.message)).build();
  }
}

// ===========================================
// BACKGROUND TRIGGER
// ===========================================

function backgroundAnalyze() {
  try {
    var threads = GmailApp.search('is:unread in:inbox', 0, 20);
    var count = 0;
    for (var i = 0; i < threads.length; i++) {
      var messages = threads[i].getMessages();
      var msg = messages[messages.length - 1];
      queueAnalysis(msg.getId(), msg.getSubject() || '', msg.getFrom() || '', (msg.getPlainBody() || '').substring(0, 4000), threads[i].getId());
      count++;
    }
    Utilities.sleep(8000);
    applyPendingLabels();
    Logger.log('Background: queued ' + count + ' emails and applied labels');
  } catch (err) {
    Logger.log('Background error: ' + err);
  }
}

function applyPendingLabels() {
  try {
    var threads = GmailApp.getInboxThreads(0, 20);
    var cache = CacheService.getUserCache();
    for (var i = 0; i < threads.length; i++) {
      var messages = threads[i].getMessages();
      var msg = messages[messages.length - 1];
      var msgId = msg.getId();
      var cached = cache.get('fw_' + msgId);
      if (cached) { applyAutoLabels(msgId, JSON.parse(cached)); continue; }
      var result = checkAnalysisResult(msgId);
      if (result && result.status === 'ready') {
        cache.put('fw_' + msgId, JSON.stringify(result.analysis), 3600);
        if (result.analysis.suggested_reply) cache.put('reply_' + msgId, result.analysis.suggested_reply, 3600);
        applyAutoLabels(msgId, result.analysis);
      }
    }
    Logger.log('✅ Labels applied');
  } catch (err) {
    Logger.log('Label error: ' + err);
  }
}

function setupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'backgroundAnalyze') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('backgroundAnalyze').timeBased().everyMinutes(15).create();
  Logger.log('✅ Trigger set up!');
}

// ===========================================
// LABEL FUNCTIONS
// ===========================================

function labelUrgent(e) { return applyLabel(e.parameters.msgId, '🔴 FW - Urgent', true); }
function labelHigh(e) { return applyLabel(e.parameters.msgId, '🟠 FW - High', false); }
function labelMedium(e) { return applyLabel(e.parameters.msgId, '🟡 FW - Medium', false); }
function labelLow(e) { return applyLabel(e.parameters.msgId, '🟢 FW - Low', false); }

function applyLabel(msgId, labelName, star) {
  try {
    var message = GmailApp.getMessageById(msgId);
    var thread = message.getThread();
    var label = GmailApp.getUserLabelByName(labelName);
    if (!label) label = GmailApp.createLabel(labelName);
    var allLabels = ['🔴 FW - Urgent', '🟠 FW - High', '🟡 FW - Medium', '🟢 FW - Low'];
    for (var i = 0; i < allLabels.length; i++) {
      var existing = GmailApp.getUserLabelByName(allLabels[i]);
      if (existing) thread.removeLabel(existing);
    }
    thread.addLabel(label);
    if (star) message.star();
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('✅ Label applied')).build();
  } catch (err) {
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('❌ Failed')).build();
  }
}

function applyAutoLabels(msgId, analysis) {
  try {
    if (!analysis || !analysis.priority) return;
    var message = GmailApp.getMessageById(msgId);
    var thread = message.getThread();
    var priorityLabels = {
      'urgent': '🔴 FW - Urgent',
      'high': '🟠 FW - High',
      'medium': '🟡 FW - Medium',
      'low': '🟢 FW - Low'
    };
    var labelName = priorityLabels[String(analysis.priority).toLowerCase()];
    if (labelName) {
      var label = GmailApp.getUserLabelByName(labelName);
      if (!label) label = GmailApp.createLabel(labelName);
      for (var key in priorityLabels) {
        var existing = GmailApp.getUserLabelByName(priorityLabels[key]);
        if (existing) thread.removeLabel(existing);
      }
      thread.addLabel(label);
      if (analysis.priority.toLowerCase() === 'urgent') message.star();
    }
  } catch (err) {
    Logger.log('Auto-label error: ' + err);
  }
}

function addRepliedLabel(msgId) {
  try {
    var message = GmailApp.getMessageById(msgId);
    var thread = message.getThread();
    var label = GmailApp.getUserLabelByName('✅ FW - Replied');
    if (!label) label = GmailApp.createLabel('✅ FW - Replied');
    thread.addLabel(label);
  } catch (err) {
    Logger.log('Replied label error: ' + err);
  }
}

// ===========================================
// HELPERS
// ===========================================

function trackReply(msgId, replyText) {
  try {
    var payload = {'emailId': msgId, 'replyText': replyText, 'source': 'gmail_addon'};
    var options = {'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(payload)};
    apiFetch('/api/track-reply', options);
  } catch (err) {
    Logger.log('Track reply error: ' + err);
  }
}