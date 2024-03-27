import CdError from './CdError';
import Comment from './Comment';
import CommentFormStatic from './CommentFormStatic';
import CommentStatic from './CommentStatic';
import Parser from './Parser';
import Section from './Section';
import SectionStatic from './SectionStatic';
import Thread from './Thread';
import cd from './cd';
import controller from './controller';
import debug from './debug';
import init from './init';
import navPanel from './navPanel';
import pageNav from './pageNav';
import pageRegistry from './pageRegistry';
import settings from './settings';
import toc from './toc';
import userRegistry from './userRegistry';
import visits from './visits';
import { defined, definedAndNotNull, getLastArrayElementOrSelf, sleep, underlinesToSpaces } from './utils';
import { getFooter } from './utils-window';
import { wrapHtml } from './utils-window';
import { formatDateNative } from './timestamp';
import { handleApiReject, saveOptions } from './apiWrappers';
import { removeWikiMarkup } from './wikitext';
import { showConfirmDialog } from './ooui';

/**
 * Get all text nodes under the root element in the window (not worker) context.
 *
 * @returns {Node[]}
 * @private
 */
function getAllTextNodes() {
  const treeWalker = document.createNodeIterator(controller.rootElement, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;
  while ((node = treeWalker.nextNode())) {
    nodes.push(node);
  }
  return nodes;
}

/**
 * Remove all html comments added by DiscussionTools related to reply buttons.
 *
 * @private
 */
function removeDtButtonHtmlComments() {
  const treeWalker = document.createNodeIterator(controller.rootElement, NodeFilter.SHOW_COMMENT);
  let node;
  while ((node = treeWalker.nextNode())) {
    if (node.textContent.startsWith('__DTREPLYBUTTONS__')) {
      node.remove();
    }
  }
}

/**
 * Deal with (remove or move in the DOM) the markup added to the page by DiscussionTools.
 *
 * @param {Element[]|external:Element[]} elements
 * @param {import('./BootProcess').default} [bootProcess]
 *
 * @private
 */
function processAndRemoveDtElements(elements, bootProcess) {
  // Reply Tool is officially incompatible with CD, so we don't care if it is enabled. New Topic
  // Tool doesn't seem to make difference for our purposes here.
  const moveNotRemove = (
    cd.g.isDtTopicSubscriptionEnabled ||

    // DT enabled by default. Don't know how to capture that another way.
    !['registered', null].includes(mw.loader.getState('ext.discussionTools.init'))
  );
  let dtMarkupHavenElement;
  if (moveNotRemove) {
    if (!bootProcess.isFirstRun()) {
      dtMarkupHavenElement = controller.$content.children('.cd-dtMarkupHaven')[0];
    }
    if (!dtMarkupHavenElement) {
      dtMarkupHavenElement = document.createElement('span');
      dtMarkupHavenElement.className = 'cd-dtMarkupHaven cd-hidden';
      controller.$content.append(dtMarkupHavenElement);
    }
  }

  elements
    .concat(
      [...controller.rootElement.getElementsByClassName('ext-discussiontools-init-highlight')]
    )
    .forEach((el, i) => {
      if (el.hasAttribute('data-mw-comment-start') && CommentStatic.isDtId(el.id)) {
        bootProcess.addDtCommentId(el.id);
      }
      if (moveNotRemove) {
        // DT gets the DOM offset of each of these elements upon initialization which can take a lot
        // of time if the elements aren't put into containers with less children.
        if (i % 10 === 0) {
          dtMarkupHavenElement.appendChild(document.createElement('span'));
        }
        dtMarkupHavenElement.lastChild.appendChild(el);
      } else {
        el.remove();
      }
    });
  if (!moveNotRemove) {
    [...controller.rootElement.getElementsByTagName('span[data-mw-comment]')].forEach((el) => {
      el.removeAttribute('data-mw-comment');
    });
  }

  // Reset some interfering methods
  const highlighter = mw.loader.moduleRegistry['ext.discussionTools.init']
    ?.packageExports['highlighter.js'];
  if (highlighter) {
    highlighter.highlightTargetComment = () => {};
    highlighter.clearHighlightTargetComment = () => {};
  }
}

/**
 * Data passed from the previous page state.
 *
 * @typedef {object} PassedData
 * @property {string} [html] HTML code of the page content to replace the current content with.
 * @property {string} [commentId] ID of a comment to scroll to.
 * @property {string} [sectionId] ID of a section to scroll to.
 * @property {string} [pushState] Whether to replace the URL in the address bar adding the comment
 *   ID to it if it's specified.
 * @property {number} [scrollY] Page's Y offset.
 * @property {object[]} [unseenCommentIds] IDs of unseen comments on this page.
 * @property {string} [justWatchedSection] Section just watched so that there could be not enough
 *   time for it to be saved to the server.
 * @property {string} [justUnwatchedSection] Section just unwatched so that there could be not
 *   enough time for it to be saved to the server.
 * @property {boolean} [wasCommentFormSubmitted] Did the user just submit a comment form.
 */

/**
 * Class representing the process of loading or reloading CD onto an article page.
 */
class BootProcess {
  /**
   * Create a boot process.
   *
   * @param {PassedData} [passedData={}]
   */
  constructor(passedData = {}) {
    this.passedData = passedData;
    this.dtCommentIds = [];
  }

  /**
   * Add a comment ID to the registry.
   *
   * @param {string} id
   * @private
   */
  addDtCommentId(id) {
    this.dtCommentIds.push(id);
  }

  /**
   * Check if the page processed for the first time after it was loaded (i.e., not reloaded using
   * the script's refresh functionality).
   *
   * @returns {boolean}
   */
  isFirstRun() {
    return this.firstRun;
  }

  /**
   * Show a popup asking the user if they want to enable the new comment formatting. Save the
   * settings after they make the choice.
   *
   * @returns {Promise.<boolean>} Did the user enable comment reformatting.
   * @private
   */
  async maybeSuggestEnableCommentReformatting() {
    if (settings.get('reformatComments') !== null) {
      return false;
    }

    const { reformatComments } = await settings.load({ reuse: true });
    if (definedAndNotNull(reformatComments)) {
      return false;
    }

    const actions = [
      {
        label: cd.s('rc-suggestion-yes'),
        action: 'accept',
        flags: 'primary',
      },
      {
        label: cd.s('rc-suggestion-no'),
        action: 'reject',
      },
    ];
    const action = await showConfirmDialog(
      $('<div>')
        .append(
          $('<img>')
            .attr('width', 626)
            .attr('height', 67)
            .attr('src', '//upload.wikimedia.org/wikipedia/commons/0/08/Convenient_Discussions_comment_-_old_format.png')
            .addClass('cd-rcnotice-img'),
          $('<img>')
            .attr('width', 30)
            .attr('height', 30)
            .attr('src', "data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M16.58 8.59L11 14.17L11 2L9 2L9 14.17L3.41 8.59L2 10L10 18L18 10L16.58 8.59Z' fill='black'/%3E%3C/svg%3E")
            .addClass('cd-rcnotice-img cd-rcnotice-arrow'),
          $('<img>')
            .attr('width', 626)
            .attr('height', 118)
            .attr('src', '//upload.wikimedia.org/wikipedia/commons/d/da/Convenient_Discussions_comment_-_new_format.png')
            .addClass('cd-rcnotice-img'),
          $('<div>')
            .addClass('cd-rcnotice-text')
            .append(
              wrapHtml(cd.sParse('rc-suggestion'), {
                callbacks: {
                  'cd-notification-settings': () => {
                    controller.showSettingsDialog();
                  },
                },
              }).children()
            ),
        )
        .children(),
      {
        size: 'large',
        actions,
      }
    );
    if (action) {
      try {
        const reformatComments = action === 'accept';
        await settings.saveSettingOnTheFly('reformatComments', reformatComments);
        return reformatComments;
      } catch (e) {
        mw.notify(cd.s('error-settings-save'), { type: 'error' });
        console.warn(e);
      }
    }
  }

  /**
   * Show a popup asking the user if they want to receive desktop notifications, or ask for a
   * permission if it has not been granted but the user has desktop notifications enabled (for
   * example, if they are using a browser different from where they have previously used). Save the
   * settings after they make the choice.
   *
   * @private
   */
  async maybeConfirmDesktopNotifications() {
    if (typeof Notification === 'undefined') return;

    if (
      settings.get('desktopNotifications') === 'unknown' &&
      Notification.permission !== 'denied'
    ) {
      // Avoid using the setting kept in `mw.user.options`, as it may be outdated. Also don't reuse
      // the previous settings request, as the settings might be changed in
      // `this.maybeSuggestEnableCommentReformatting()`.
      const { desktopNotifications } = await settings.load();
      if (['unknown', undefined].includes(desktopNotifications)) {
        const actions = [
          {
            label: cd.s('dn-confirm-yes'),
            action: 'accept',
            flags: 'primary',
          },
          {
            label: cd.s('dn-confirm-no'),
            action: 'reject',
          },
        ];
        const action = await showConfirmDialog(cd.s('dn-confirm'), {
          size: 'medium',
          actions,
        });
        let promise;
        if (action === 'accept') {
          if (Notification.permission === 'default') {
            OO.ui.alert(cd.s('dn-grantpermission'));
            Notification.requestPermission((permission) => {
              if (permission === 'granted') {
                promise = settings.saveSettingOnTheFly('desktopNotifications', 'all');
              } else if (permission === 'denied') {
                promise = settings.saveSettingOnTheFly('desktopNotifications', 'none');
              }
            });
          } else if (Notification.permission === 'granted') {
            promise = settings.saveSettingOnTheFly('desktopNotifications', 'all');
          }
        } else if (action === 'reject') {
          promise = settings.saveSettingOnTheFly('desktopNotifications', 'none');
        }
        if (promise) {
          try {
            await promise;
          } catch (e) {
            mw.notify(cd.s('error-settings-save'), { type: 'error' })
            console.warn(e);
          }
        }
      }
    }

    if (
      !['unknown', 'none'].includes(settings.get('desktopNotifications')) &&
      Notification.permission === 'default'
    ) {
      await OO.ui.alert(cd.s('dn-grantpermission-again'), { title: cd.s('script-name') });
      Notification.requestPermission();
    }
  }

  /**
   * Make a search request and show a "Not found" notification.
   *
   * @param {object} data
   * @private
   */
  async searchForNotFoundItem({
    date,
    decodedFragment,
    guessedCommentText,
    sectionName,
    guessedSectionText,
  }) {
    const token = date ?
      formatDateNative(date, false, cd.g.contentTimezone) :
      sectionName.replace(/"/g, '');
    let searchQuery = `"${token}"`;

    let sectionNameDotDecoded;
    if (!date) {
      try {
        sectionNameDotDecoded = decodeURIComponent(
          sectionName.replace(/\.([0-9A-F]{2})/g, '%$1')
        );
      } catch {
        // Empty
      }
    }
    if (sectionNameDotDecoded && sectionName !== sectionNameDotDecoded) {
      const tokenDotDecoded = sectionNameDotDecoded.replace(/"/g, '');
      searchQuery += ` OR "${tokenDotDecoded}"`;
    }

    if (date) {
      // There can be a time difference between the time we know (taken from the history) and the
      // time on the page. We take it to be not more than 3 minutes for the time on the page.
      for (let gap = 1; gap <= 3; gap++) {
        const adjustedToken = formatDateNative(
          new Date(date.getTime() - cd.g.msInMin * gap),
          false,
          cd.g.contentTimezone
        );
        searchQuery += ` OR "${adjustedToken}"`;
      }
    }
    const archivePrefix = pageRegistry.getCurrent().getArchivePrefix();
    searchQuery += ` prefix:${archivePrefix}`;

    const resp = await controller.getApi().get({
      action: 'query',
      list: 'search',
      srsearch: searchQuery,
      srprop: date ? undefined : 'sectiontitle',

      // List more recent archives first
      srsort: 'create_timestamp_desc',

      srlimit: '20'
    });
    const results = resp?.query?.search;

    const searchUrl = (
      cd.g.server +
      mw.util.getUrl('Special:Search', {
        search: searchQuery,
        sort: 'create_timestamp_desc',
        cdcomment: date && decodedFragment,
      })
    );

    if (results.length === 0) {
      let label;
      if (date) {
        label = (
          cd.sParse('deadanchor-comment-lead') +
          ' ' +
          cd.sParse('deadanchor-comment-notfound', searchUrl) +
          guessedCommentText
        );
      } else {
        label = (
          cd.sParse('deadanchor-section-lead', sectionName) +
          (
            guessedSectionText && sectionName.includes('{{') ?
              // Use of a template in the section title. In such a case, it's almost always the real
              // match, so we don't show any fail messages.
              '' :

              (
                ' ' +
                cd.sParse('deadanchor-section-notfound', searchUrl) +
                ' ' +
                cd.sParse('deadanchor-section-reason', searchUrl)
              )
          ) +
          guessedSectionText
        );
      }
      mw.notify(wrapHtml(label), {
        type: 'warn',
        autoHideSeconds: 'long',
      });
    } else {
      let exactMatchPageTitle;

      // Will be either sectionName or sectionNameDotDecoded.
      let sectionNameFound = sectionName;

      if (date) {
        const matches = Object.entries(results)
          .map(([, result]) => result)
          .filter((result) => (
            removeWikiMarkup(result.snippet)?.includes(token)
          ));
        if (matches.length === 1) {
          exactMatchPageTitle = matches[0].title;
        }
      } else {
        // Obtain the first exact section title match (which would be from the most recent archive).
        // This loop iterates over just one item in the vast majority of cases.
        const exactMatch = Object.entries(results)
          .map(([, result]) => result)
          .find((result) => (
            result.sectiontitle &&
            [sectionName, sectionNameDotDecoded].filter(defined).includes(result.sectiontitle)
          ));
        if (exactMatch) {
          exactMatchPageTitle = exactMatch.title;
          sectionNameFound = underlinesToSpaces(exactMatch.sectiontitle);
        }
      }

      let label;
      if (exactMatchPageTitle) {
        const fragment = date ? decodedFragment : sectionNameFound;
        const wikilink = `${exactMatchPageTitle}#${fragment}`;
        label = date ?
          cd.sParse('deadanchor-comment-exactmatch', wikilink, searchUrl) + guessedCommentText :
          cd.sParse('deadanchor-section-exactmatch', sectionNameFound, wikilink, searchUrl);
      } else {
        label = date ?
          cd.sParse('deadanchor-comment-inexactmatch', searchUrl) + guessedCommentText :
          cd.sParse('deadanchor-section-inexactmatch', sectionNameFound, searchUrl);
      }

      mw.notify(wrapHtml(label), {
        autoHideSeconds: 'long',
      });
    }
  }

  /**
   * Show a notification that a section/comment was not found, a link to search in the archive, a
   * link to the section/comment if it was found automatically, and/or a link to a section found
   * with a similar name or a comment found with the closest date in the past.
   *
   * @param {string} decodedFragment Decoded fragment.
   * @param {Date} [date] Comment date, if there is a comment ID in the fragment.
   * @param {string} [author] Comment author, if there is a comment ID in the fragment.
   * @private
   */
  async maybeNotifyNotFound(decodedFragment, date, author) {
    let label;
    let guessedCommentText = '';
    let sectionName;
    let guessedSectionText = '';
    const articlePathRegexp = new RegExp(
      mw.util.escapeRegExp(mw.config.get('wgArticlePath')).replace('\\$1', '(.*)')
    );

    if (date) {
      label = cd.sParse('deadanchor-comment-lead');
      const previousCommentByTime = CommentStatic.findPreviousCommentByTime(date, author);
      if (previousCommentByTime) {
        guessedCommentText = (
          ' ' +
          cd.sParse('deadanchor-comment-previous', '#' + previousCommentByTime.id)
        )
          // Until https://phabricator.wikimedia.org/T288415 is online on most wikis.
          .replace(articlePathRegexp, '$1');
        label += guessedCommentText;
      }
    } else {
      sectionName = underlinesToSpaces(decodedFragment);
      label = (
        cd.sParse('deadanchor-section-lead', sectionName) +
        ' ' +
        cd.sParse('deadanchor-section-reason')
      );
      const sectionMatch = SectionStatic.findByHeadlineParts(sectionName);
      if (sectionMatch) {
        guessedSectionText = (
          ' ' +
          cd.sParse('deadanchor-section-similar', '#' + sectionMatch.id, sectionMatch.headline)
        )
          // Until https://phabricator.wikimedia.org/T288415 is online on most wikis.
          .replace(articlePathRegexp, '$1');

        label += guessedSectionText;
      }
    }

    if (pageRegistry.getCurrent().canHaveArchives()) {
      this.searchForNotFoundItem({
        date,
        decodedFragment,
        guessedCommentText,
        sectionName,
        guessedSectionText,
      });
    } else {
      mw.notify(wrapHtml(label), {
        type: 'warn',
        autoHideSeconds: 'long',
      });
    }
  }

  /**
   * Disable DT with a method supplied in a parameter.
   *
   * @param {boolean} globally
   * @param {import('./Button').default} button
   * @param {import('./notifications').Notification} notification
   * @private
   */
  async disableDt(globally, button, notification) {
    button.setPending(true);
    try {
      const options = {
        'discussiontools-replytool': 0,
        'discussiontools-newtopictool': 0,
        'discussiontools-topicsubscription': 0,
        'discussiontools-visualenhancements': 0,
      };
      if (globally) {
        await saveOptions(options, true).catch(handleApiReject);
      } else {
        await controller.getApi().saveOptions({
          'discussiontools-topicsubscription': 1,
        }).catch(handleApiReject);
      }
    } catch (e) {
      mw.notify(wrapHtml(cd.sParse('error-settings-save')));
      return;
    } finally {
      button.setPending(false);
    }
    notification.$notification.hide();
    mw.notify(
      wrapHtml(cd.sParse('discussiontools-disabled'), {
        callbacks: {
          'cd-notification-refresh': () => {
            location.reload();
          },
        },
      })
    );
  }

  /**
   * Show a notification informing the user that CD is incompatible with DiscussionTools and
   * suggesting to disable DiscussionTools.
   *
   * @private
   */
  maybeSuggestDisableDiscussionTools() {
    if (!cd.g.isDtReplyToolEnabled) return;

    const notification = mw.notification.notify(
      wrapHtml(
        cd.sParse(
          'discussiontools-incompatible',
          'Special:Preferences#mw-prefsection-editing-discussion',
          'Special:GlobalPreferences#mw-prefsection-editing-discussion',
        ),
        {
          callbacks: {
            'cd-notification-disabledt': (e, button) => {
              this.disableDt(false, button, notification);
            },
            'cd-notification-disableDtGlobally': (e, button) => {
              this.disableDt(true, button, notification);
            },
          },
        }
      ),
      {
        type: 'warn',
        autoHide: false,
      }
    );
  }

  /**
   * Add a settings link to the page footer.
   */
  addSettingsLinkToFooter() {
    getFooter().append(
      $('<li>').append(
        $('<a>')
          .text(cd.s('footer-settings'))
          .on('click', () => {
            controller.showSettingsDialog();
          })
      )
    );
  }

  /**
   * Setup various components required for the boot process. Some DOM preparations are also made
   * here.
   *
   * @private
   */
  async setup() {
    if (this.firstRun) {
      await init.talkPage();
    }
    this.subscriptions = controller.getSubscriptionsInstance();
    if (this.firstRun) {
      toc.init(this.subscriptions);
    }
    controller.setup(this.passedData.html);
    toc.setup(this.passedData.toc, this.passedData.hidetoc);

    /**
     * Collection of all comments on the page ordered the same way as in the DOM.
     *
     * @see module:CommentStatic.getAll
     * @name comments
     * @type {Comment[]}
     * @memberof convenientDiscussions
     */
    cd.comments = CommentStatic.getAll();

    /**
     * Collection of all sections on the page ordered the same way as in the DOM.
     *
     * @see module:SectionStatic.getAll
     * @name sections
     * @type {Section[]}
     * @memberof convenientDiscussions
     */
    cd.sections = SectionStatic.getAll();
  }

  /**
   * Find comment signatures and section headings on the page.
   *
   * @private
   */
  findTargets() {
    this.parser = new Parser({
      CommentClass: Comment,
      SectionClass: Section,
      childElementsProp: 'children',
      follows: (el1, el2) => Boolean(
        el2.compareDocumentPosition(el1) & Node.DOCUMENT_POSITION_FOLLOWING
      ),
      getAllTextNodes,
      getElementByClassName: (el, className) => el.querySelector(`.${className}`),
      rootElement: controller.rootElement,
      areThereOutdents: controller.areThereOutdents.bind(controller),
      processAndRemoveDtElements,
      removeDtButtonHtmlComments,
    });

    this.parser.processAndRemoveDtMarkup(this);
    const headings = this.parser.findHeadings();
    const signatures = this.parser.findSignatures();
    this.targets = headings
      .concat(signatures)
      .sort((t1, t2) => this.parser.context.follows(t1.element, t2.element) ? 1 : -1);
  }

  /**
   * Parse the comments and modify the related parts of the DOM.
   *
   * @private
   */
  processComments() {
    try {
      this.targets
        .filter((target) => target.type === 'signature')
        .forEach((signature) => {
          try {
            CommentStatic.add(this.parser.createComment(signature, this.targets));
          } catch (e) {
            if (!(e instanceof CdError)) {
              console.error(e);
            }
          }
        });

      CommentStatic.reformatTimestamps();
      CommentStatic.findAndUpdateTableComments();
      CommentStatic.adjustDom();
    } catch (e) {
      console.error(e);
    }

    /**
     * The script has processed comments, except for reformatting them in
     * {@link CommentStatic.reformatComments} if the user opted in for that.
     *
     * @event commentsReady
     * @param {object} comments {@link convenientDiscussions.comments} object.
     * @param {object} cd {@link convenientDiscussions} object.
     */
    mw.hook('convenientDiscussions.commentsReady').fire(CommentStatic.getAll(), cd);
  }

  /**
   * Parse the sections and modify some parts of them.
   *
   * @param {Promise} [visitsPromise]
   * @private
   */
  processSections(visitsPromise) {
    this.targets
      .filter((target) => target.type === 'heading')
      .forEach((heading) => {
        try {
          SectionStatic.add(this.parser.createSection(heading, this.targets, this.subscriptions));
        } catch (e) {
          if (!(e instanceof CdError)) {
            console.error(e);
          }
        }
      });

    if (this.subscriptions.getType() === 'dt') {
      // Can't do it earlier: we don't have section DT IDs until now.
      this.subscriptions.loadToTalkPage(this, visitsPromise);
    }

    SectionStatic.init(this.subscriptions);

    // Dependent on sections being set
    CommentStatic.processOutdents(this.parser);

    // Dependent on outdents being processed
    CommentStatic.connectBrokenThreads();

    // This runs after extracting sections because Comment#getParent needs sections to be set on
    // comments.
    CommentStatic.setDtIds(this.dtCommentIds);

    // Depends on DT IDs being set
    SectionStatic.addMetadataAndActions();

    /**
     * The script has processed sections.
     *
     * @event sectionsReady
     * @param {object} sections {@link convenientDiscussions.sections} object.
     * @param {object} cd {@link convenientDiscussions} object.
     */
    mw.hook('convenientDiscussions.sectionsReady').fire(SectionStatic.getAll(), cd);
  }

  /**
   * Do the required transformations if the page turned out to be not a talk page after all.
   *
   * @private
   */
  retractTalkPageness() {
    debug.stopTimer('main code');

    controller.setTalkPageness(false);

    const $disableLink = $('#footer-places-togglecd a');
    $disableLink
      .attr('href', $disableLink.attr('href').replace(/0$/, '1'))
      .text(cd.s('footer-runcd'));

    controller.hideLoadingOverlay();
    this.debugLog();
  }

  /**
   * Update the page's HTML.
   *
   * @private
   */
  layOutHtml() {
    controller.$content
      .children('.mw-parser-output')
      .remove()
        .end()
      .prepend(controller.$root);
  }

  /**
   * Add an "Add topic" button to the bottom of the page if there is an "Add topic" tab. (Otherwise,
   * it may be added to a wrong place.)
   *
   * @private
   */
  addAddTopicButton() {
    if (
      // Vector 2022 has "Add topic" in the sticky header, so our button would duplicate its purpose
      cd.g.skin !== 'vector-2022' ||

      !$('#ca-addsection').length ||

      // There is a special welcome text in New Topic Tool for 404 pages.
      (cd.g.isDtNewTopicToolEnabled && !controller.doesPageExist())
    ) {
      return;
    }

    controller.setAddSectionButtonContainer(
      $('<div>')
        .addClass('cd-section-button-container cd-addTopicButton-container')
        .append(
          (new OO.ui.ButtonWidget({
            label: cd.s('addtopic'),
            framed: false,
            classes: ['cd-button-ooui', 'cd-section-button'],
          })).on('click', () => {
            CommentFormStatic.createAddSectionForm();
          }).$element
        )

        // If appending to `controller.rootElement`, it can land on a wrong place, like on 404 pages
        // with New Topic Tool enabled.
        .insertAfter(controller.$root)
    );
  }

  /**
   * Bind a click handler to every known "Add new topic" button.
   *
   * @private
   */
  connectToAddTopicButtons() {
    $(
      [
        '#ca-addsection a',
        '.cd-addTopicButton a',
        'a.cd-addTopicButton',
        'a[href*="section=new"]',
        'a[href*="Special:NewSection/"]',
        'a[href*="Special:Newsection/"]',
        'a[href*="special:newsection/"]',
        '.commentbox input[type="submit"]',
        '.createbox input[type="submit"]',
      ]
        .concat(cd.config.addTopicButtonSelectors)
        .join(', ')
    )
      .filter(function () {
        const $button = $(this);

        // When DT's new topic tool is enabled
        if (
          mw.util.getParamValue('section') === 'new' &&
          $button.parent().attr('id') !== 'ca-addsection' &&
          !$button.closest(controller.$root).length
        ) {
          return false;
        }

        let pageName;
        let url;
        if ($button.is('a')) {
          url = new URL($button.prop('href'));
          pageName = getLastArrayElementOrSelf(url.searchParams.getAll('title'))
            ?.replace(/^Special:NewSection\//i, '');
        } else if ($button.is('input')) {
          pageName = $button
            .closest('form')
            .find('input[name="title"][type="hidden"]')
            .val();
        } else {
          return false;
        }
        let page;
        try {
          page = pageRegistry.get(pageName);
        } catch (e) {
          return false;
        }
        if (page !== pageRegistry.getCurrent()) {
          return false;
        }
        if ($button.is('a')) {
          url.searchParams.set('dtenable', 0);
          $button.attr('href', url);
        }
        return true;
      })

      // DT may add its handler (as adds to a "Start new discussion" button on 404 pages). DT's "Add
      // topic" button click handler is trickier, see below.
      .off('click')

      .on('click.cd', controller.handleAddTopicButtonClick.bind(controller))
      .filter(function () {
        const $button = $(this);
        return (
          !cd.g.isDtNewTopicToolEnabled &&
          !($button.is('a') && Number(mw.util.getParamValue('cdaddtopic', $button.attr('href'))))
        );
      })
      .attr('title', cd.s('addtopicbutton-tooltip'));

    // In case DT's new topic tool is enabled, remove the handler of the "Add topic" button.
    const dtHandler = $._data(document.body).events?.click
      ?.find((event) => event.selector?.includes('data-mw-comment'))
      ?.handler;
    if (dtHandler) {
      $(document.body).off('click', dtHandler);
    }
  }

  /**
   * _For internal use._ Show a modal with content of comment forms that we were unable to restore
   * to the page (because their target comments/sections disappeared, for example).
   *
   * @param {object[]} content
   * @param {string} [content[].headline]
   * @param {string} content[].comment
   * @param {string} content[].summary
   */
  rescueCommentFormsContent(content) {
    const text = content
      .map((data) => {
        let text = data.headline !== undefined ?
          `${cd.s('rd-headline')}: ${data.headline}\n\n` :
          '';
        text += `${cd.s('rd-comment')}: ${data.comment}\n\n${cd.s('rd-summary')}: ${data.summary}`;
        return text;
      })
      .join('\n\n----\n');

    const dialog = new OO.ui.MessageDialog();
    controller.getWindowManager().addWindows([dialog]);
    controller.getWindowManager().openWindow(dialog, {
      message: (new OO.ui.FieldLayout(
        new OO.ui.MultilineTextInputWidget({
          value: text,
          rows: 20,
        }),
        {
          align: 'top',
          label: cd.s('rd-intro'),
        }
      )).$element,
      actions: [
        {
          label: cd.s('rd-close'),
          action: 'close',
        },
      ],
      size: 'large',
    });
  }

  /**
   * If a DT's comment form is present (for example, on `&action=edit&section=new` pages), remove it
   * and later replace it with ours, keeping the input.
   *
   * @private
   */
  hideDtNewTopicForm() {
    if (!cd.g.isDtNewTopicToolEnabled) return;

    // `:visible` to exclude the form hidden in BootProcess#hideDtNewTopicForm.
    const $dtNewTopicForm = $('.ext-discussiontools-ui-newTopic:visible');
    if (!$dtNewTopicForm.length) return;

    const $headline = $dtNewTopicForm
      .find('.ext-discussiontools-ui-newTopic-sectionTitle input[type="text"]');
    const headline = $headline.val();
    $headline.val('');

    const $comment = $dtNewTopicForm.find('textarea');
    const comment = $comment.textSelection('getContents');
    $comment.textSelection('setContents', '');

    // DT's comment form produces errors after opening a CD's comment form because of hard code in
    // WikiEditor that relies on $('#wpTextbox1'). We can't simply delete DT's dummy textarea
    // because it can show up unexpectedly right before WikiEditor's code is executed where it's
    // hard for us to wedge in.
    if ($('#wpTextbox1').length) {
      $('#wpTextbox1').remove();
    } else {
      const observer = new MutationObserver((records) => {
        const isReplyWidgetAdded = (record) => (
          [...record.addedNodes]
            .some((node) => node.classList?.contains('ext-discussiontools-ui-replyWidget'))
        );
        if (records.some(isReplyWidgetAdded)) {
          $('#wpTextbox1').remove();
          observer.disconnect();
        }
      });
      observer.observe(controller.$content[0], {
        childList: true,
        subtree: true,
      });
    }

    // Don't outright remove the element so that DT has time to save the draft as empty.
    $dtNewTopicForm.hide();

    // This looks like it regulates adding a new topic form on DT init. This is for future page
    // refreshes.
    mw.config.set('wgDiscussionToolsStartNewTopicTool', false);

    this.dtNewTopicFormData = {
      headline,
      comment,
      focus: true,
    };
  }

  /**
   * Add an "Add section" form if needed.
   *
   * @private
   */
  maybeAddAddSectionForm() {
    // May crash if the current URL contains undecodable "%" in the fragment,
    // https://phabricator.wikimedia.org/T207365.
    const { searchParams } = new URL(location.href);

    // &action=edit&section=new when DT's New Topic Tool is enabled.
    if (
      searchParams.get('section') === 'new' ||
      Number(searchParams.get('cdaddtopic')) ||
      this.dtNewTopicFormData
    ) {
      CommentFormStatic.createAddSectionForm(undefined, undefined, this.dtNewTopicFormData);
    }
  }

  /**
   * Add a condition to show a confirmation when trying to close the page with active comment forms
   * on it.
   *
   * @private
   */
  configureActiveCommentFormsConfirmation() {
    const alwaysConfirmLeavingPage = (
      mw.user.options.get('editondblclick') ||
      mw.user.options.get('editsectiononrightclick')
    );
    controller.addPreventUnloadCondition('commentForms', () => {
      CommentFormStatic.saveSession(true);
      return (
        mw.user.options.get('useeditwarning') &&
        (
          CommentFormStatic.getLastActiveAltered() ||
          (alwaysConfirmLeavingPage && CommentFormStatic.getCount())
        )
      );
    });
  }

  /**
   * Perform URL fragment-related tasks.
   *
   * @private
   */
  async processFragment() {
    if (!this.firstRun) return;

    const fragment = location.hash.slice(1);
    const escapedFragment = $.escapeSelector(fragment);
    let decodedFragment;
    let escapedDecodedFragment;
    let commentId;
    try {
      decodedFragment = decodeURIComponent(fragment);
      escapedDecodedFragment = decodedFragment && $.escapeSelector(decodedFragment);
      if (CommentStatic.isId(fragment)) {
        commentId = decodedFragment;
      }
    } catch (e) {
      console.error(e);
    }

    let date;
    let author;
    let comment;
    if (commentId) {
      ({ date, author } = CommentStatic.parseId(commentId) || {});
      comment = CommentStatic.getById(commentId, true);
    } else if (decodedFragment) {
      ({ comment, date, author } = CommentStatic.getByDtId(decodedFragment, true) || {});
    }

    if (comment) {
      // `sleep()` is for Firefox - for some reason, without it Firefox positions the underlay
      // incorrectly. (TODO: does it still? Need to check.)
      sleep().then(() => {
        comment.scrollTo({
          smooth: false,
          expandThreads: true,
        });

        // Replace CD's comment ID in the fragment with DiscussionTools' if available.
        const newFragment = comment.dtId ? `#${comment.dtId}` : undefined;
        const newState = Object.assign({}, history.state, { cdJumpedToComment: true });
        history.replaceState(newState, '', newFragment);
      });
    }

    if (decodedFragment && !pageRegistry.getCurrent().isArchivePage()) {
      const isTargetFound = (
        comment ||
        cd.config.idleFragments.some((regexp) => decodedFragment.match(regexp)) ||

        // `/media/` is from MediaViewer, `noticeApplied` is from RedWarn
        /^\/media\/|^noticeApplied-|^h-/.test(decodedFragment) ||

        $(':target').length ||
        $(`a[name="${escapedDecodedFragment}"]`).length ||
        $(`*[id="${escapedDecodedFragment}"]`).length ||
        $(`a[name="${escapedFragment}"]`).length ||
        $(`*[id="${escapedFragment}"]`).length
      );
      if (!isTargetFound) {
        await this.maybeNotifyNotFound(decodedFragment, date, author);
      }
    }
  }

  /**
   * Process the data passed to the boot process related to target comments or section and perform
   * the relevant actions with it.
   *
   * @private
   */
  async processTargets() {
    const commentIds = this.passedData.commentIds;
    if (commentIds) {
      const comments = commentIds.map((id) => CommentStatic.getById(id)).filter(definedAndNotNull);
      if (comments.length) {
        // `sleep()` for Firefox, as above
        sleep().then(() => {
          // A tricky case with flashing is when a comment is in a collapsed thread. In this case,
          // we must use Comment#scrollTo to make sure it is flashed when the thread is uncollapsed
          // by clicking a link in the notification.
          const flashOne = this.passedData.wasCommentFormSubmitted || this.passedData.pushState;
          comments[0].scrollTo({
            smooth: false,
            pushState: this.passedData.pushState,
            flash: flashOne,
          });
          if (!flashOne) {
            comments.forEach((comment) => comment.flashTarget());
          }
        });
      }
    }

    if (this.passedData.sectionId) {
      const section = SectionStatic.getById(this.passedData.sectionId);
      if (section) {
        if (this.passedData.pushState) {
          history.pushState(history.state, '', `#${section.id}`);
        }

        // `sleep()` for Firefox, as above
        sleep().then(() => {
          section.$heading.cdScrollTo('top', false);
        });
      }
    }
  }

  /**
   * Bind a click handler to comment links to make them work as in-script comment links.
   *
   * This method exists in addition to {@link module:controller.handlePopState}. It's preferable to
   * have click events handled by this method instead of `controller.handlePopState` because that
   * method, if encounters `cdJumpedToComment` in the history state, doesn't scroll to the comment
   * which is a wrong behavior when the user clicks a link.
   *
   * @param {external:jQuery} $content
   * @private
   */
  connectToCommentLinks($content) {
    if (!$content.is('#mw-content-text, .cd-commentForm-preview')) return;

    $content
      .find(`a[href^="#"]`)
      .filter(function () {
        return !this.onclick && CommentStatic.isAnyId($(this).attr('href').slice(1));
      })
      .on('click', function (e) {
        e.preventDefault();
        CommentStatic.getByAnyId($(this).attr('href').slice(1), true)?.scrollTo({
          expandThreads: true,
          pushState: true,
        });
      });
  }

  /**
   * Highlight mentions of the current user.
   *
   * @param {external:jQuery} $content
   * @private
   */
  highlightMentions($content) {
    if (!$content.is('#mw-content-text, .cd-comment-part')) return;

    const currentUserName = userRegistry.getCurrent().getName();
    const excludeSelector = [
      settings.get('reformatComments') ?
        'cd-comment-author' :
        'cd-signature'
    ]
      .concat(cd.config.noSignatureClasses)
      .map((name) => `.${name}`)
      .join(', ');
    $content
      .find(
        $content.hasClass('cd-comment-part') ?
          `a[title$=":${currentUserName}"], a[title*=":${currentUserName} ("]` :
          `.cd-comment-part a[title$=":${currentUserName}"], .cd-comment-part a[title*=":${currentUserName} ("]`
      )
      .filter(function () {
        return (
          cd.g.userLinkRegexp.test(this.title) &&
          !this.closest(excludeSelector) &&
          Parser.processLink(this)?.userName === userRegistry.getCurrent().getName()
        );
      })
      .each((i, link) => {
        link.classList.add('cd-currentUserLink');
      });
  }

  /**
   * Add event listeners to `window`, `document`, hooks.
   *
   * @private
   */
  addEventListeners() {
    if (!settings.get('reformatComments')) {
      // The `mouseover` event allows to capture the state when the cursor is not moving but ends up
      // above a comment but not above any comment parts (for example, as a result of scrolling).
      // The benefit may be low compared to the performance cost, but it's unexpected when the user
      // scrolls a comment and it suddenly stops being highlighted because the cursor is between
      // neighboring `<p>`'s.
      $(document).on('mousemove mouseover', controller.handleMouseMove.bind(controller));
    }

    // We need the `visibilitychange` event because many things may move while the document is
    // hidden, and the movements are not processed when the document is hidden.
    $(document)
      .on('scroll visibilitychange', controller.handleScroll.bind(controller))
      .on('horizontalscroll.cd visibilitychange', controller.handleHorizontalScroll.bind(controller))
      .on('selectionchange', controller.handleSelectionChange.bind(controller));

    if (settings.get('improvePerformance')) {
      // Unhide when the user opens a search box to allow searching the full page.
      $(window)
        .on('focus', SectionStatic.maybeUpdateVisibility.bind(SectionStatic))
        .on('blur', SectionStatic.maybeUnhideAll.bind(SectionStatic));
    }

    $(window)
      .on('resize orientationchange', controller.handleWindowResize.bind(controller))
      .on('popstate', controller.handlePopState.bind(controller));

    // Should be above `mw.hook('wikipage.content').fire` so that it runs for the whole page content
    // as opposed to `$('.cd-comment-author-wrapper')`.
    mw.hook('wikipage.content').add(
      this.connectToCommentLinks.bind(this),
      this.highlightMentions.bind(this)
    );
    mw.hook('convenientDiscussions.previewReady').add(this.connectToCommentLinks.bind(this));

    // Mutation observer doesn't follow all possible comment position changes (for example,
    // initiated with adding new CSS) unfortunately.
    setInterval(controller.handlePageMutations.bind(controller), 1000);

    if (controller.isPageCommentable()) {
      $(document).on('keydown', controller.handleGlobalKeyDown.bind(controller));
    }

    mw.hook('wikipage.content').add(controller.handleWikipageContentHookFirings.bind(controller));
  }

  /**
   * Log debug data to the console.
   *
   * @private
   */
  debugLog() {
    debug.stopTimer('total time');

    const baseTime = (
      debug.getTimerTotal('main code') +
      debug.getTimerTotal('final code and rendering')
    );
    const timePerComment = baseTime / CommentStatic.getCount();

    debug.logAndResetTimer('total time');
    console.debug(`number of comments: ${CommentStatic.getCount()}`);
    console.debug(`per comment: ${timePerComment.toFixed(2)}`);
    debug.logAndResetEverything();
  }

  /**
   * Show popups to the user if needed.
   *
   * @private
   */
  async showPopups() {
    this.maybeSuggestDisableDiscussionTools();

    const didEnableCommentReformatting = await this.maybeSuggestEnableCommentReformatting();
    await this.maybeConfirmDesktopNotifications();
    if (didEnableCommentReformatting) {
      controller.reload();
    }
  }

  /**
   * _For internal use._ Execute the process.
   *
   * @param {boolean} isReload Is the page reloaded.
   * @fires beforeParse
   * @fires commentsReady
   * @fires sectionsReady
   * @fires pageReady
   * @fires pageReadyFirstTime
   */
  async execute(isReload) {
    this.firstRun = !isReload;
    if (this.firstRun) {
      debug.stopTimer('load data');
    }

    debug.startTimer('preparations');
    await this.setup();
    debug.stopTimer('preparations');

    debug.startTimer('main code');

    if (this.firstRun) {
      controller.saveRelativeScrollPosition();

      userRegistry.loadMuted();
    }

    /*
      To make things systematized, we have 4 possible assessments of page activeness as a talk page,
      sorted by the scope of enabled features. Each level includes the next ones; 3 is the
      intersection of 2.1 and 2.2.
        1. The page is a wikitext (article) page.
        2. The page is likely a talk page. controller.isTalkPage() reflects that. We may reevaluate
           page as being not a talk page (see BootProcess#retractTalkPageness()) if we don't find
           any comments on it and several other criteria are not met. Likely talk pages are divided
           into two categories:
        2.1. The page is eligible to create comment forms on. (This includes 404 pages where the
             user could create a section, but excludes archive pages and old revisions.)
             controller.isPageCommentable() reflects this level.
        2.2. The page exists (not a 404 page). controller.doesPageExists() shows this. (This
             includes archive pages and old revisions, which are not eligible to create comment
             forms on.) Such pages are parsed, the page navigation block is added to them.
        3. The page is active. This means, it's not a 404 page, not an archive page, and not an old
           revision. controller.isPageActive() is true when the page is of this level. The
           navigation panel is added to such pages, new comments are highlighted.

      We need to be accurate regarding which functionality should be turned on on which level. We
      should also make sure we only add this functionality once.
    */

    let visitsPromise;
    if (controller.doesPageExist()) {
      if (controller.isPageActive()) {
        visitsPromise = visits.get(this, true);
      }

      if (this.subscriptions.getType() === 'legacy') {
        this.subscriptions.loadToTalkPage(this, visitsPromise, true);
      }

      /**
       * The script is going to parse the page for comments, sections, etc.
       *
       * @event beforeParse
       * @param {object} cd {@link convenientDiscussions} object.
       */
      mw.hook('convenientDiscussions.beforeParse').fire(cd);

      debug.startTimer('process comments');
      this.findTargets();
      this.processComments();
      debug.stopTimer('process comments');
    }

    if (this.firstRun && !controller.isDefinitelyTalkPage() && !CommentStatic.getCount()) {
      this.retractTalkPageness();
      return;
    }

    if (controller.doesPageExist()) {
      debug.startTimer('process sections');
      this.processSections();
      debug.stopTimer('process sections');
    } else {
      if (this.subscriptions.getType() === 'dt') {
        this.subscriptions.loadToTalkPage(this, visitsPromise);
      }
    }

    if (this.passedData.html) {
      debug.startTimer('laying out HTML');
      this.layOutHtml();
      debug.stopTimer('laying out HTML');
    }

    navPanel.setup();

    debug.stopTimer('main code');

    // Operations that need reflow, such as `getBoundingClientRect()`, and those dependent on them
    // go in this section.
    debug.startTimer('final code and rendering');

    if (controller.doesPageExist()) {
      // Should be above all code that deals with comment highlightable elements and comment levels
      // as this may alter that.
      CommentStatic.reviewHighlightables();

      CommentStatic.reformatComments();
    }

    // This updates some styles, shifting the offsets.
    controller.$root.addClass('cd-parsed');

    if (controller.isPageCommentable()) {
      this.addAddTopicButton();
      this.connectToAddTopicButtons();

      // Should be below the viewport position restoration as it may rely on elements that are made
      // hidden during the comment forms restoration (NOT FULFILLED - FIXME? But the comment for
      // `Thread.init()` seems to contradict). Should be below `navPanel.setup()` as
      // `CommentFormStatic.restoreSession()` indirectly calls `navPanel.updateCommentFormButton()`
      // which depends on the navigation panel being mounted.
      CommentFormStatic.restoreSession(this.firstRun || this.passedData.isPageReloadedExternally);

      this.hideDtNewTopicForm();
      this.maybeAddAddSectionForm();

      if (this.isFirstRun()) {
        this.configureActiveCommentFormsConfirmation();
      }
    }

    if (controller.doesPageExist()) {
      // Should be below the comment form restoration for threads to be expanded correctly and also
      // to avoid repositioning threads after the addition of comment forms. Should be above the
      // viewport position restoration as it may shift the layout (if the viewport position
      // restoration relies on elements that are made hidden when threads are collapsed, the
      // algorithm finds the expand note). Should better be above comment highlighting
      // (`CommentStatic.configureAndAddLayers()`, `processVisits()`) to avoid spending time on
      // comments in collapsed threads.
      Thread.init();

      // Should better be below the comment form restoration to avoid repositioning of layers
      // after the addition of comment forms.
      CommentStatic.configureAndAddLayers((c) => (
        c.isOwn ||

        // Need to generate a gray line to close the gaps between adjacent list item elements. Do it
        // here, not after processing comments, to group all operations requiring reflow
        // together for performance reasons.
        c.isLineGapped
      ));

      // Should be below `Thread.init()` as these methods may want to scroll to a comment in a
      // collapsed thread.
      this.processFragment();
      this.processTargets();

      if (!controller.isPageActive()) {
        toc.addCommentCount();
      }

      if (this.isFirstRun()) {
        pageNav.mount();

        this.addEventListeners();
      } else {
        pageNav.update();
      }

      // We set the setup observer at every reload because `controller.$content` may change.
      controller.setupMutationObserver();

      if (settings.get('reformatComments') && CommentStatic.getCount()) {
        // Using the `wikipage.content` hook could theoretically disrupt code that needs to process
        // the whole page content, if it runs later than CD. But typically CD runs relatively late.
        mw.hook(cd.config.hookToFireWithAuthorWrappers).fire($('.cd-comment-author-wrapper'));
      }
    }

    if (this.firstRun) {
      // Restore the initial viewport position in terms of visible elements, which is how the user
      // sees it.
      controller.restoreRelativeScrollPosition();

      this.addSettingsLinkToFooter();
    }

    /**
     * The script has processed the page.
     *
     * @event pageReady
     * @param {object} cd {@link convenientDiscussions} object.
     */
    mw.hook('convenientDiscussions.pageReady').fire(cd);

    if (this.firstRun) {
      /**
       * The script has processed the page for the first time since the page load. Use this hook
       * for operations that should run only once.
       *
       * @event pageReadyFirstTime
       * @param {object} cd {@link convenientDiscussions} object.
       */
      mw.hook('convenientDiscussions.pageReadyFirstTime').fire(cd);
    }

    controller.hideLoadingOverlay();

    // This is needed to calculate the rendering time: it won't complete until everything gets
    // rendered.
    controller.rootElement.getBoundingClientRect();

    debug.stopTimer('final code and rendering');

    this.debugLog();

    if (this.firstRun && controller.isPageActive() && userRegistry.getCurrent().isRegistered()) {
      this.showPopups();
    }
  }
}

export default BootProcess;
