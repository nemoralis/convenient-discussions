export default {
  messages: {
    'sun': 'Sun',
    'mon': 'Mon',
    'tue': 'Tue',
    'wed': 'Wed',
    'thu': 'Thu',
    'fri': 'Fri',
    'sat': 'Sat',
    'sunday': 'Sunday',
    'monday': 'Monday',
    'tuesday': 'Tuesday',
    'wednesday': 'Wednesday',
    'thursday': 'Thursday',
    'friday': 'Friday',
    'saturday': 'Saturday',
    'jan': 'Jan',
    'feb': 'Feb',
    'mar': 'Mar',
    'apr': 'Apr',
    'may': 'May',
    'jun': 'Jun',
    'jul': 'Jul',
    'aug': 'Aug',
    'sep': 'Sep',
    'oct': 'Oct',
    'nov': 'Nov',
    'dec': 'Dec',
    'january': 'January',
    'february': 'February',
    'march': 'March',
    'april': 'April',
    'may_long': 'May',
    'june': 'June',
    'july': 'July',
    'august': 'August',
    'september': 'September',
    'october': 'October',
    'november': 'November',
    'december': 'December',
    'january-gen': 'January',
    'february-gen': 'February',
    'march-gen': 'March',
    'april-gen': 'April',
    'may-gen': 'May',
    'june-gen': 'June',
    'july-gen': 'July',
    'august-gen': 'August',
    'september-gen': 'September',
    'october-gen': 'October',
    'november-gen': 'November',
    'december-gen': 'December',
    'timezone-utc': 'UTC',
    'parentheses': '($1)',
    'parentheses-start': '(',
    'parentheses-end': ')',
    'word-separator': ' ',
    'comma-separator': ', ',
    'colon-separator': ': ',
    'nextdiff': 'Newer edit →',
    'pagetitle': '$1 - Meta',
    'discussiontools-topicsubscription-button-subscribe': 'subscribe',
    'discussiontools-topicsubscription-button-subscribe-tooltip': '{{GENDER:|Subscribe}} to receive notifications about new comments.',
    'discussiontools-topicsubscription-button-unsubscribe': 'unsubscribe',
    'discussiontools-topicsubscription-button-unsubscribe-tooltip': '{{GENDER:|Unsubscribe}} to stop receiving notifications about new comments.',
    'discussiontools-topicsubscription-notify-subscribed-title': '{{GENDER:|You}} have subscribed!',
    'discussiontools-topicsubscription-notify-subscribed-body': '{{GENDER:|You}} will receive notifications about new comments in this topic.',
    'discussiontools-topicsubscription-notify-unsubscribed-title': '{{GENDER:|You}} have unsubscribed.',
    'discussiontools-topicsubscription-notify-unsubscribed-body': '{{GENDER:|You}} will no longer receive notifications about new comments in this topic.',
    'discussiontools-newtopicssubscription-button-subscribe-label': 'Subscribe',
    'discussiontools-newtopicssubscription-button-subscribe-tooltip': 'Subscribe to receive notifications when new topics are started on this page.',
    'discussiontools-newtopicssubscription-button-unsubscribe-label': 'Unsubscribe',
    'discussiontools-newtopicssubscription-button-unsubscribe-tooltip': 'Unsubscribe to stop receiving notifications when new topics are started on this page.',
    'discussiontools-newtopicssubscription-notify-subscribed-title': '{{GENDER:|You}} have subscribed!',
    'discussiontools-newtopicssubscription-notify-subscribed-body': '{{GENDER:|You}} will receive notifications when new topics are started on this page.',
    'discussiontools-newtopicssubscription-notify-unsubscribed-title': '{{GENDER:|You}} have unsubscribed.',
    'discussiontools-newtopicssubscription-notify-unsubscribed-body': '{{GENDER:|You}} will no longer receive notifications when new topics are started on this page.',
    'visualeditor-educationpopup-dismiss': 'Okay, got it',
  },
  specialPageAliases: {
    'Contributions': 'Contributions',
    'Diff': 'Diff',
    'PermanentLink': 'PermanentLink',
  },
  timezone: 'UTC',
  useGlobalPreferences: true,
  archivePaths: [/\/Archive/],
  signatureEndingRegexp: / \(talk\)$/,
  tagName: 'convenient-discussions',
  hookToFireWithAuthorWrappers: 'global.userlinks',
  unsignedTemplates: [
    'Unsigned',
    'Unsigned3',
    'Unsigned2',
    'Unsigned IP',
    'Unsigned-ip',
    'UnsignedIP',
  ],
  paragraphTemplates: [
    'pb',
    'Paragraph break',
  ],
  outdentTemplates: [
    'outdent',
    'Unindent',
    'Od',
    'OUTDENT',
  ],
  clearTemplates: [
    'Clear',
    'Br',
  ],
  quoteFormatting: function (mentionSource, author, timestamp, dtId) {
    var pre = '';
    var post = '';
    if (mentionSource) {
      pre = '{{tqb|text=';
      if (author) {
        post += '|by=' + author;
      }
      if (timestamp) {
        post += '|ts=' + timestamp;
      }
      if (dtId) {
        post += '|id=' + dtId;
      }
      post += '}}';
    } else {
      pre = '{{tq|1='
      post += '}}<br>';
    }
    return [pre, post];
  },
  noSignatureClasses: [
    'NavHead',
  ],
  noSignatureTemplates: [
    'Moved',
  ],
  excludeFromHeadlineClasses: [
    'adminMark',
  ],
  closedDiscussionTemplates: [
    [
      'Closed',
      'Discussion top',
      'Dt',
      'Archive top',
      'Hidden archive top',
      'Hat',
    ],
    [
      'Discussion bottom',
      'Archive bottom',
      'Hidden archive bottom',
      'Hab',
    ],
  ],
  closedDiscussionClasses: [
    'boilerplate',
    'NavFrame',
    'NavContent',
    'mw-collapsed',
  ],
  beforeAuthorLinkParse: function (authorLink) {
    // https://meta.wikimedia.org/wiki/MediaWiki:Gadget-markAdmins.js
    return authorLink.lastElementChild;
  },
  afterAuthorLinkParse: function (authorLink, adminMarkCandidate) {
    if (adminMarkCandidate && adminMarkCandidate.classList.contains('adminMark')) {
      authorLink.appendChild(adminMarkCandidate);
    }
  },
};
