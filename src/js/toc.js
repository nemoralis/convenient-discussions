/**
 * Table of contents-related functions.
 *
 * @module toc
 */

import Comment from './Comment';
import Section from './Section';
import cd from './cd';
import { reloadPage } from './boot';
import { restoreScrollPosition, saveScrollPosition } from './util';

let tocItems;

export default {
  /**
   * Hide the TOC if the relevant cookie is set. This method duplicates {@link
   * https://phabricator.wikimedia.org/source/mediawiki/browse/master/resources/src/mediawiki.toc/toc.js
   * the native MediaWiki function} and exists because we may need to hide the TOC earlier than the
   * native method does it.
   */
  possiblyHide() {
    if (!cd.g.$toc.length) return;

    if (mw.cookie.get('hidetoc') === '1') {
      cd.g.$toc.find('.toctogglecheckbox').prop('checked', true);
    }
  },

  /**
   * Reset TOC data (executed at each page reload).
   */
  reset() {
    tocItems = null;
    cd.g.$toc = cd.g.$root.find('.toc');
    const $closestFloating = cd.g.$toc.closest(
      '[style*="float: right"], [style*="float:right"], [style*="float: left"], [style*="float:left"]'
    );
    cd.g.isTocFloating = Boolean(
      $closestFloating.length && cd.g.$root.has($closestFloating).length
    );
  },

  /**
   * Get a TOC item by anchor.
   *
   * @param {string} anchor
   * @returns {?object}
   */
  getItem(anchor) {
    if (!cd.g.$toc.length) {
      return null;
    }

    if (!tocItems) {
      cd.debug.startTimer('tocItems');
      // It is executed first time before not rendered (gray) sections are added to the TOC, so we
      // use a simple algorithm to obtain items. We also expect that the number and text are the
      // first two children of a <li> element.
      tocItems = Array.from(cd.g.$toc.get(0).querySelectorAll('li > a')).map((a) => {
        const textSpan = a.children[1];
        const headline = textSpan.textContent;
        const anchor = a.getAttribute('href').slice(1);
        const li = a.parentNode;
        let [, level] = li.className.match(/\btoclevel-(\d+)/);
        level = Number(level);
        const number = a.children[0].textContent;
        return {
          headline,
          anchor,
          level,
          number,
          $element: $(li),
          $link: $(a),
          $text: $(textSpan),
        };
      });
      cd.debug.stopTimer('tocItems');
    }

    return tocItems.find((item) => item.anchor === anchor) || null;
  },

  /**
   * Highlight (bold) watched sections.
   */
  highlightWatchedSections() {
    if (!cd.settings.modifyToc || !cd.g.$toc.length) return;

    cd.sections
      .filter((section) => section.isWatched)
      .forEach((section) => {
        section.updateTocLink();
      });
  },

  /**
   * Object with the same basic structure as {@link module:SectionSkeleton} has. (It comes from a
   * web worker so its constuctor is lost.)
   *
   * @typedef {object} SectionSkeletonLike
   */

  /**
   * Add links to new, not yet rendered sections (loaded in the background) to the table of
   * contents.
   *
   * Note that this method may also add the `match` property to the section elements containing a
   * matched `Section` object.
   *
   * @param {SectionSkeletonLike[]} sections All sections present on the new revision of the page.
   */
  addNewSections(sections) {
    if (!cd.settings.modifyToc || !cd.g.$toc.length) return;

    cd.debug.startTimer('addNewSections');
    cd.debug.startTimer('addNewSections remove');

    cd.g.$toc
      .find('.cd-toc-notRenderedSectionList, .cd-toc-notRenderedSection')
      .remove();

    cd.debug.stopTimer('addNewSections remove');
    cd.debug.startTimer('addNewSections parent');

    /*
      Note the case when the page starts with sections of lower levels than the base level, like
      this:

      === Section 1 ===
      ==== Section 2 ====
      == Section 3 ==

      In this case, the TOC will look like this:
      1 Section 1
        1.1 Section 2
      2 Section 3

      The other possible case when the level on the page is different from the level in the TOC
      is when there is a gap between the levels on the page. For example:

      == Section ==
      ==== Subsection ====

      will be displayed like this in the TOC:

      1 Section
        1.1 Subsection
     */
    sections.forEach((section, i) => {
      section.parent = sections
        .slice(0, i)
        .reverse()
        .find((otherSection) => otherSection.level < section.level);
    });
    sections.forEach((section) => {
      section.tocLevel = section.parent ? section.parent.tocLevel + 1 : 1;
    });

    cd.debug.stopTimer('addNewSections parent');
    cd.debug.startTimer('addNewSections add');

    let currentTree = [];
    const $topUl = cd.g.$toc.children('ul');
    sections.forEach((section) => {
      cd.debug.startTimer('addNewSections add search');
      section.match = Section.search(section);
      cd.debug.stopTimer('addNewSections add search');
      let item = section.match?.getTocItem();

      if (!item) {
        const headline = section.headline;
        const level = section.tocLevel;
        const currentLevelMatch = currentTree[level - 1];
        let upperLevelMatch;
        if (!currentLevelMatch) {
          upperLevelMatch = currentTree[currentTree.length - 1];
        }

        cd.debug.startTimer('addNewSections add vanilla');

        const li = document.createElement('li');
        li.className = `cd-toc-notRenderedSection toclevel-${level}`;

        const a = document.createElement('a')
        a.href = '#' + section.anchor;
        a.onclick = (e) => {
          e.preventDefault();
          reloadPage({
            sectionAnchor: section.anchor,
            pushState: true,
          });
        };
        li.appendChild(a);
        if (cd.g.thisPageWatchedSections?.includes(headline)) {
          a.className = 'cd-toc-watched';
          a.title = cd.s('toc-watched');
        }

        let number;
        if (currentLevelMatch) {
          number = currentLevelMatch.number;
        } else if (upperLevelMatch) {
          number = upperLevelMatch.number + '.1';
        } else {
          number = '1';
        }
        const numberSpan = document.createElement('span');
        numberSpan.className = 'tocnumber cd-toc-hiddenTocNumber';
        numberSpan.textContent = number;
        a.appendChild(numberSpan);

        const textSpan = document.createElement('span');
        textSpan.className = 'toctext';
        textSpan.textContent = section.headline;
        a.appendChild(textSpan);

        if (currentLevelMatch) {
          currentLevelMatch.$element.after(li);
        } else if (upperLevelMatch) {
          const ul = document.createElement('ul');
          ul.className = `cd-toc-notRenderedSectionList toclevel-${level}`;
          ul.appendChild(li);
          upperLevelMatch.$element.append(ul);
        } else {
          $topUl.prepend(li);
        }

        cd.debug.stopTimer('addNewSections add vanilla');

        item = {
          headline,
          level,
          number,
          $element: $(li),
        };
      }

      currentTree[section.tocLevel - 1] = item;
      currentTree.splice(section.tocLevel);
    });

    cd.debug.stopTimer('addNewSections add');
    cd.debug.stopTimer('addNewSections');
  },

  /**
   * Object with the same basic structure as {@link module:CommentSkeleton} has. (It comes from a
   * web worker so its constuctor is lost.)
   *
   * @typedef {object} CommentSkeletonLike
   */

  /**
   * Add links to new comments (either already displayed or loaded in the background) to the table
   * of contents.
   *
   * @param {CommentSkeletonLike[]|Comment[]} commentsBySection
   * @param {object} keptData
   */
  addNewComments(commentsBySection, keptData) {
    if (!cd.settings.modifyToc || !cd.g.$toc.length) return;

    const firstComment = commentsBySection.values().next().value?.[0];
    if (!firstComment) return;

    const areCommentsRendered = firstComment instanceof Comment;

    const saveTocHeight = Boolean(
      !(cd.g.hasPageBeenReloaded && areCommentsRendered) ||

      // When the comment or section is opened by a link from the TOC
      keptData.commentAnchor ||
      keptData.sectionAnchor
    );
    saveScrollPosition(saveTocHeight);

    cd.g.$toc
      .find('.cd-toc-notRenderedCommentList')
      .remove();

    cd.debug.startTimer('addNewComments sections cycle');
    commentsBySection.forEach((comments, sectionOrAnchor) => {
      if (!sectionOrAnchor) return;

      // There could be a collision of hrefs between the existing section and not yet rendered
      // section, so we compose the selector carefully.
      cd.debug.startTimer('addNewComments sections selector');
      const $sectionLink = typeof sectionOrAnchor === 'string' ?
        cd.g.$toc.find(
          `.cd-toc-notRenderedSection a[href="#${$.escapeSelector(sectionOrAnchor)}"]`
        ) :
        sectionOrAnchor.getTocItem().$link;
      cd.debug.stopTimer('addNewComments sections selector');

      // Should never be the case
      if (!$sectionLink?.length) return;

      let $target = $sectionLink;
      const $next = $sectionLink.next('.cd-toc-newCommentList');
      if ($next.length) {
        $target = $next;
      }
      const target = $target.get(0);

      // jQuery is too expensive here given that very many comments may be added.
      const ul = document.createElement('ul');
      ul.className = areCommentsRendered ?
        'cd-toc-newCommentList' :
        'cd-toc-notRenderedCommentList';

      let moreTooltipText = '';
      comments.forEach((comment, i) => {
        cd.debug.startTimer('addNewComments comments prepare');
        const parent = areCommentsRendered ? comment.getParent() : comment.parent;
        const names = parent?.author && comment.level > 1 ?
          cd.s('navpanel-newcomments-names', comment.author.name, parent.author.name) :
          comment.author.name;
        const date = comment.date ?
          cd.util.formatDate(comment.date) :
          cd.s('navpanel-newcomments-unknowndate');
        const text = (
          names +
          (cd.g.SITE_DIR === 'rtl' ? '\u200F' : '') +
          cd.mws('comma-separator') +
          date
        );
        cd.debug.stopTimer('addNewComments comments prepare');

        cd.debug.startTimer('addNewComments comments DOM');

        // If there are 5 comments or less, show all of them. If there are more, show 4 and "N
        // more". (Because showing 4 and then "1 more" is stupid.)
        if (i < 4 || comments.length === 5) {
          const li = document.createElement('li');
          ul.appendChild(li);

          const bulletSpan = document.createElement('span');
          bulletSpan.className = 'tocnumber cd-toc-bullet';
          bulletSpan.innerHTML = cd.sParse('bullet');
          li.appendChild(bulletSpan);

          const textSpan = document.createElement('span');
          textSpan.className = 'toctext';
          li.appendChild(textSpan);

          const a = document.createElement('a');
          a.href = `#${comment.anchor}`;
          a.textContent = text;
          textSpan.appendChild(a);

          if (comment instanceof Comment) {
            a.onclick = (e) => {
              e.preventDefault();
              comment.scrollToAndHighlightTarget(false, true);
            };
          } else {
            a.onclick = (e) => {
              e.preventDefault();
              reloadPage({
                commentAnchor: comment.anchor,
                pushState: true,
              });
            };
          }
        } else {
          moreTooltipText += text + '\n';
        }
        cd.debug.stopTimer('addNewComments comments DOM');
      });

      cd.debug.startTimer('addNewComments sections DOM');
      if (comments.length > 5) {
        const span = document.createElement('span');
        span.className = 'cd-toc-more';
        span.title = moreTooltipText.trim();
        span.textContent = cd.s('toc-more', comments.length - 4);

        const li = document.createElement('li');
        li.appendChild(span);
        ul.appendChild(li);
      }

      cd.debug.stopTimer('addNewComments sections DOM');
      target.parentNode.insertBefore(ul, target.nextSibling);
    });
    cd.debug.stopTimer('addNewComments sections cycle');

    restoreScrollPosition();
  },
};
