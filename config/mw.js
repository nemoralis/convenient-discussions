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
    'pagetitle': '$1 - Wikimedia Commons',
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
  signatureEndingRegexp: / \(talk\)$/,
  tagName: 'convenient-discussions',
  unsignedTemplates: [
    'Unsigned',
    'Nosig',
    'Unsigned IP',
    'Unsigned2',
    'Unsignedr',
    'Nosigr'
  ],
  outdentTemplates: [
    'outdent'
  ],
  clearTemplates: [
    'Clear',
    'Clr',
    '-'
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
  closedDiscussionTemplates: [
    [
      'Hidden archive top'
    ],
    [
      'Hidden archive bottom'
    ]
  ]
};
