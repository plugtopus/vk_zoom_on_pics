var hzInit = hzInit || false;
var link_counter = 1;

var hoverZoomPlugins = hoverZoomPlugins || [];

var files = {
    loadimg: chrome['extension'].getURL('img/loading.gif')
};

var hoverZoom = {
    options: {},
    currentLink: null,
    hzImg: null,
    imgLoading: null,
    pageGenerator: '',

    loadHoverZoom: function() {

        var hz = hoverZoom,
            wnd = jQuery(window),
            body = jQuery(document.body),
            hzCaption = null,
            hzGallery = null,
            imgFullSize = null,
            imgThumb = null,
            mousePos = {},
            loading = false,
            loadFullSizeImageTimeout,
            preloadTimeout,
            actionKeyDown = false,
            fullZoomKeyDown = false,
            hideKeyDown = false,
            skipFadeIn = false,
            titledElements = null,
            body100pct = true,
            linkRect = null;

        var imgDetails = {
                url: '',
                host: '',
                naturalHeight: 0,
                naturalWidth: 0
            },
            thumbDetails = {
                url: '',
                naturalHeight: 0,
                naturalWidth: 0
            };


        var flashFixDomains = [
            'www.redditmedia.com'
        ];

        function posImg(position) {
            if (!imgFullSize) {
                return;
            }

            if (position === undefined || position.top === undefined || position.left === undefined) {
                position = {
                    top: mousePos.top,
                    left: mousePos.left
                };
            }

            var offset = 20,
                padding = 10,
                statusBarHeight = 15,
                wndWidth = wnd.width(),
                wndHeight = wnd.height(),
                wndScrollLeft = wnd.scrollLeft(),
                wndScrollTop = wnd.scrollTop(),
                bodyWidth = body.width(),
                displayOnRight = (position.left - wndScrollLeft < wndWidth / 2);

            function posCaption() {
                if (hzCaption) {
                    hzCaption.css('max-width', imgFullSize.width());
                    if (hzCaption.height() > 20) {
                        hzCaption.css('font-weight', 'normal');
                    }
                    var i = 0;
                    while (hz.hzImg.height() > wndHeight - statusBarHeight && i++ < 10) {
                        imgFullSize.height(wndHeight - padding - statusBarHeight - hzCaption.height()).width('auto');
                        hzCaption.css('max-width', imgFullSize.width());
                    }
                }
            }

            if (displayOnRight) {
                position.left += offset;
            } else {
                position.left -= offset;
            }

            if (hz.imgLoading) {
                position.top -= 10;
                if (!displayOnRight) {
                    position.left -= 25;
                }
            } else {
                var fullZoom = options.mouseUnderlap || fullZoomKeyDown;

                imgFullSize.width('auto').height('auto');

                imgDetails.naturalWidth = imgFullSize.width();
                imgDetails.naturalHeight = imgFullSize.height();
                if (!imgDetails.naturalWidth || !imgDetails.naturalHeight) {
                    return;
                }

                if (fullZoom) {
                    imgFullSize.width(Math.min(imgDetails.naturalWidth, wndWidth - padding + wndScrollLeft));
                } else {
                    if (displayOnRight) {
                        if (imgDetails.naturalWidth + padding > wndWidth - position.left) {
                            imgFullSize.width(wndWidth - position.left - padding + wndScrollLeft);
                        }
                    } else {
                        if (imgDetails.naturalWidth + padding > position.left) {
                            imgFullSize.width(position.left - padding - wndScrollLeft);
                        }
                    }
                }

                if (hz.hzImg.height() > wndHeight - padding - statusBarHeight) {
                    imgFullSize.height(wndHeight - padding - statusBarHeight).width('auto');
                }

                posCaption();

                position.top -= hz.hzImg.height() / 2;

                if (!displayOnRight) {
                    position.left -= hz.hzImg.width() + padding;
                }

                if (fullZoom) {
                    if (displayOnRight) {
                        position.left = Math.min(position.left, wndScrollLeft + wndWidth - hz.hzImg.width() - padding);
                    } else {
                        position.left = Math.max(position.left, wndScrollLeft);
                    }
                }

                var maxTop = wndScrollTop + wndHeight - hz.hzImg.height() - padding - statusBarHeight;
                if (position.top > maxTop) {
                    position.top = maxTop;
                }
                if (position.top < wndScrollTop) {
                    position.top = wndScrollTop;
                }
            }


            if (body100pct) {
                position.left -= (wndWidth - bodyWidth) / 2;
            }

            hz.hzImg.css({
                top: Math.round(position.top),
                left: Math.round(position.left)
            });
        }

        function posWhileLoading() {
            if (loading) {
                posImg();
                if (hz.imgLoading && imgFullSize && imgFullSize.height() > 0) {
                    displayFullSizeImage();
                } else {
                    setTimeout(function() {
                        posWhileLoading();
                    }, 100);
                }
            }
        }

        function removeTitles() {
            if (titledElements) {
                return;
            }
            titledElements = jQuery('[title]').not('iframe, .lightbox, [rel^="lightbox"]');
            titledElements.each(function() {
                jQuery(this).data().hoverZoomTitle = this.getAttribute('title');
                this.removeAttribute('title');
            });
        }

        function restoreTitles() {
            if (!titledElements) {
                return;
            }
            titledElements.each(function() {
                if (jQuery(this).data()) {
                    this.setAttribute('title', jQuery(this).data().hoverZoomTitle);
                }
            });
            titledElements = null;
        }

        function hideHoverZoomImg(now) {

            if (!now && !imgFullSize || !hz.hzImg || fullZoomKeyDown) {
                return;
            }
            imgFullSize = null;
            if (loading) {
                now = true;
            }
            hz.hzImg.stop(true, true).fadeOut(now ? 0 : options.fadeDuration, function() {
                hzCaption = null;
                hz.imgLoading = null;
                hz.hzImg.empty();
                restoreTitles();
            });
        }

        function documentMouseMove(event) {
            if (!options.extensionEnabled || fullZoomKeyDown || isExcludedSite() || wnd.height() < 30 || wnd.width() < 30) {
                return;
            }

            var links,
                target = jQuery(event.target),
                explicitCall = event.pageY == undefined;


            if (explicitCall) {
                links = hz.currentLink;
            } else {
                mousePos = {
                    top: event.pageY,
                    left: event.pageX
                };
                links = target.parents('.hoverZoomLink');
                if (target.hasClass('hoverZoomLink')) {
                    links = links.add(target);
                }
            }

            if (options.mouseUnderlap && target.length && mousePos && linkRect &&
                (imgFullSize && imgFullSize.length && target[0] == imgFullSize[0] ||
                    hz.hzImg && hz.hzImg.length && target[0] == hz.hzImg[0])) {
                if (mousePos.top > linkRect.top && mousePos.top < linkRect.bottom && mousePos.left > linkRect.left && mousePos.left < linkRect.right) {
                    return;
                }
            }

            if (links && links.length > 0) {
                var hoverZoomSrcIndex = links.data().hoverZoomSrcIndex || 0;
                if (links.data().hoverZoomSrc && links.data().hoverZoomSrc != 'undefined' &&
                    links.data().hoverZoomSrc[hoverZoomSrcIndex] &&
                    links.data().hoverZoomSrc[hoverZoomSrcIndex] != 'undefined') {
                    if (links.data().hoverZoomSrc[hoverZoomSrcIndex] != imgDetails.url) {
                        hideHoverZoomImg();
                    }

                    removeTitles();

                    if (!imgFullSize) {
                        hz.currentLink = links;
                        if (!options.actionKey || actionKeyDown) {
                            imgDetails.url = links.data().hoverZoomSrc[hoverZoomSrcIndex];
                            clearTimeout(loadFullSizeImageTimeout);

                            var delay = explicitCall ? 0 : options.displayDelay;
                            loadFullSizeImageTimeout = setTimeout(function() {
                                loadFullSizeImage();
                            }, delay);

                            loading = true;
                        }
                    } else {
                        posImg();
                    }
                }
            } else if (hz.currentLink) {
                cancelImageLoading();
            }
        }

        function documentMouseDown(event) {
            if (imgFullSize && event.target != hz.hzImg[0] && event.target != imgFullSize[0]) {
                cancelImageLoading();
                restoreTitles();
            }
        }

        function loadFullSizeImage() {
            if (!imgFullSize) {
                hz.createHzImg(!hideKeyDown);
                hz.createImgLoading();

                imgFullSize = jQuery('<img style="border: none" />').appendTo(hz.hzImg).load(imgFullSizeOnLoad).error(imgFullSizeOnError).attr('src', imgDetails.url);

                imgDetails.host = getHostFromUrl(imgDetails.url);

                skipFadeIn = false;
                imgFullSize.addClass('progressCss');
                if (options.showWhileLoading) {
                    posWhileLoading();
                }
                posImg();
                //}});
            }
            posImg();
        }

        function imgFullSizeOnLoad() {

            if (imgDetails.url == jQuery(imgFullSize).attr('src')) {
                loading = false;
                if (hz.imgLoading) {
                    displayFullSizeImage();
                }
            }
        }

        function initLinkRect(elem) {
            linkRect = elem.offset();
            var height = elem.height();
            var width = elem.width();
            if (height == 0 || width == 0) {
                height = elem.children().height();
                width = elem.children().width();
            }
            linkRect.bottom = linkRect.top + height;
            linkRect.right = linkRect.left + width;
        }

        function displayFullSizeImage() {
            hz.imgLoading.remove();
            hz.imgLoading = null;
            hz.hzImg.stop(true, true);
            hz.hzImg.offset({
                top: -9000,
                left: -9000
            });
            hz.hzImg.empty();

            clearTimeout(cursorHideTimeout);
            hz.hzImg.css('cursor', 'none');

            imgFullSize.addClass('imgFullSizeCss').appendTo(hz.hzImg).mousemove(imgFullSizeOnMouseMove);

            if (hz.currentLink) {
                imgThumb = hz.currentLink;
                var lowResSrc = imgThumb.attr('src');
                if (!lowResSrc) {
                    imgThumb = hz.currentLink.find('[src]').first();
                    lowResSrc = imgThumb.attr('src');
                }
                if (!lowResSrc) {
                    imgThumb = hz.currentLink.find('[style]').first();
                    if (imgThumb.context.classList) {
                        lowResSrc = hz.getThumbUrl(imgThumb);
                    }
                }
                lowResSrc = lowResSrc || 'noimage';
                if (loading && lowResSrc.indexOf('noimage') == -1) {
                    var ext = imgDetails.url.substr(imgDetails.url.length - 3).toLowerCase();
                    if (ext != 'gif' && ext != 'svg' && ext != 'png') {
                        var imgRatio = imgFullSize.width() / imgFullSize.height(),
                            thumbRatio = imgThumb.width() / imgThumb.height();
                        if (Math.abs(imgRatio - thumbRatio) < 0.1) {
                            imgFullSize.css({
                                'background-image': 'url(' + lowResSrc + ')'
                            });
                        }
                    }
                } else {
                    imgThumb = null;
                }

                hz.hzImg.css('cursor', 'pointer');

                initLinkRect(imgThumb || hz.currentLink);
            }

            if (hz.currentLink) {
                var linkData = hz.currentLink.data();
                if (options.showCaptions && linkData.hoverZoomCaption) {
                    hzCaption = jQuery('<div/>', {
                        id: 'hzCaption',
                        text: linkData.hoverZoomCaption
                    }).addClass('hzCaptionCss').appendTo(hz.hzImg);
                }
                if (linkData.hoverZoomGallerySrc) {
                    var info = (linkData.hoverZoomGalleryIndex + 1) + '/' + linkData.hoverZoomGallerySrc.length;
                    hzGallery = jQuery('<div/>', {
                        id: 'hzGallery',
                        text: info
                    }).addClass('hzGalleryInfoCss').appendTo(hz.hzImg);
                    if (linkData.hoverZoomGalleryIndex == 0 && linkData.hoverZoomGallerySrc.length > 1) {
                        preloadGalleryImage(1);
                    }
                }
            }
            if (!skipFadeIn && !hideKeyDown) {
                hz.hzImg.hide().fadeTo(options.fadeDuration, options.picturesOpacity);
            }

            setTimeout(function() {
                posImg();
            }, options.showWhileLoading ? 0 : 10);
        }

        function imgFullSizeOnError() {
            if (imgDetails.url == jQuery(this).attr('src')) {
                var hoverZoomSrcIndex = hz.currentLink ? hz.currentLink.data().hoverZoomSrcIndex : 0;
                if (hz.currentLink && hoverZoomSrcIndex < hz.currentLink.data().hoverZoomSrc.length - 1) {

                    imgFullSize.remove();
                    imgFullSize = null;
                    hoverZoomSrcIndex++;
                    hz.currentLink.data().hoverZoomSrcIndex = hoverZoomSrcIndex;
                    imgDetails.url = hz.currentLink.data().hoverZoomSrc[hoverZoomSrcIndex];
                    setTimeout(function() {
                        loadFullSizeImage();
                    }, 100);
                } else {
                    hideHoverZoomImg();
                    console.warn('[HoverZoom] Failed to load image: ' + imgDetails.url);
                }
            }
        }

        var firstMouseMoveAfterCursorHide = false,
            cursorHideTimeout = 0;

        function hideCursor() {
            firstMouseMoveAfterCursorHide = true;
            hz.hzImg.css('cursor', 'none');
        }

        function imgFullSizeOnMouseMove() {

            if (!imgFullSize && !options.mouseUnderlap) {
                hideHoverZoomImg(true);
            }
            clearTimeout(cursorHideTimeout);
            if (!firstMouseMoveAfterCursorHide) {
                hz.hzImg.css('cursor', 'pointer');
                cursorHideTimeout = setTimeout(function() {
                    hideCursor();
                }, 500);
            }
            firstMouseMoveAfterCursorHide = false;
        }

        function cancelImageLoading() {
            hz.currentLink = null;
            clearTimeout(loadFullSizeImageTimeout);

            hideHoverZoomImg();
        }

        function prepareImgCaption(link) {
            var titledElement = null;
            if (link.attr('title')) {
                titledElement = link;
            } else {
                titledElement = link.find('[title]');
                if (!titledElement.length) {
                    titledElement = link.parents('[title]');
                }
            }
            if (titledElement && titledElement.length) {
                link.data().hoverZoomCaption = titledElement.attr('title');
            } else {
                var alt = link.attr('alt') || link.find('[alt]').attr('alt');
                if (alt && alt.length > 6 && !/^\d+$/.test(alt)) {
                    link.data().hoverZoomCaption = alt;
                } else {
                    var ref = link.attr('ref') || link.find('[ref]').attr('ref');
                    if (ref && ref.length > 6 && !/^\d+$/.test(ref)) {
                        link.data().hoverZoomCaption = ref;
                    }
                }
            }
        }

        function imgLinksPrepared(links) {

            links.each(function() {
                var link = jQuery(this),
                    linkData = link.data();
                if (!linkData.hoverZoomSrc && !linkData.hoverZoomGallerySrc) {
                    prepareImgLinksAsync(true);
                } else {
                    if (linkData.hoverZoomSrc) {
                        var url = linkData.hoverZoomSrc[0],
                            skip = (url == link.attr('src'));
                        if (!skip) {
                            link.find('img[src]').each(function() {
                                if (this.src == url) {
                                    skip = true;
                                }
                            });
                        }
                        if (skip) {
                            return;
                        }
                    }
                    if (!options.extensionEnabled || isExcludedSite()) {
                        return;
                    }

                    link.addClass('hoverZoomLink');

                    if (linkData.hoverZoomGallerySrc) {
                        linkData.hoverZoomGalleryIndex = 0;
                        linkData.hoverZoomGallerySrc = linkData.hoverZoomGallerySrc.map(function(srcs) {
                            return srcs.map(deepUnescape);
                        });

                        updateImageFromGallery(link);
                    } else {
                        linkData.hoverZoomSrc = linkData.hoverZoomSrc.map(deepUnescape);
                    }

                    linkData.hoverZoomSrcIndex = 0;

                    if (options.showCaptions && !linkData.hoverZoomCaption) {
                        prepareImgCaption(link);
                    }
                }
            });
        }

        function prepareImgLinks() {

            for (var i = 0; i < hoverZoomPlugins.length; i++) {
                hoverZoomPlugins[i].prepareImgLinks(imgLinksPrepared);
            }
            prepareImgLinksTimeout = null;

            if (options.alwaysPreload) {
                clearTimeout(preloadTimeout);
                preloadTimeout = setTimeout(function() {
                    hz.preloadImages();
                }, 800);
            }
        }

        var prepareDownscaledImagesDelay = 500,
            prepareDownscaledImagesTimeout;

        function prepareDownscaledImagesAsync(dontResetDelay) {
            if (!dontResetDelay) {
                prepareDownscaledImagesDelay = 500;
            }
            clearTimeout(prepareDownscaledImagesTimeout);
            prepareDownscaledImagesTimeout = setTimeout(function() {
                prepareDownscaledImages();
            }, prepareDownscaledImagesDelay);
            prepareDownscaledImagesDelay *= 2;
        }

        function prepareDownscaledImages() {
            if (['www.facebook.com'].indexOf(location.host) > -1) {
                return;
            }

            jQuery('img').filter(function() {
                var _this = jQuery(this);

                if (this.src.toLowerCase().lastIndexOf('.jpg') != this.src.length - 4) {
                    return false;
                }

                if (_this.data().hoverZoomSrc) {
                    return false;
                }

                if (this == document.body.firstChild) {
                    return false;
                }

                var scaled = this.getAttribute('width') || this.getAttribute('height') ||
                    this.style && (this.style.width || this.style.height || this.style.maxWidth || this.style.maxHeight);
                if (!scaled) {
                    scaled = scaled || _this.css('width') != '0px' || _this.css('height') != '0px' || _this.css('max-width') != 'none' || _this.css('max-height') != 'none';
                }
                return scaled;
            }).one('mouseover.hoverZoom', function() {
                var img = jQuery(this),
                    widthAttr = parseInt(this.getAttribute('width') || this.style.width || this.style.maxWidth || img.css('width') || img.css('max-width')),
                    heightAttr = parseInt(this.getAttribute('height') || this.style.height || this.style.maxHeight || img.css('height') || img.css('max-height')),
                    hzDownscaled = jQuery('<img id="hzDownscaled" style="position: absolute; top: -10000px;">').appendTo(document.body);

                if (widthAttr > 300 || heightAttr > 300) {
                    return;
                }
                hzDownscaled.load(function() {
                    setTimeout(function() {
                        {
                            var srcs = img.data().hoverZoomSrc || [];
                            srcs.unshift(img.attr('src'));
                            img.data().hoverZoomSrc = srcs;
                            img.addClass('hoverZoomLink');
                        }
                        hzDownscaled.remove();
                    }, 10);
                }).attr('src', this.src);
            });
        }

        var prepareImgLinksDelay = 500,
            prepareImgLinksTimeout;

        function prepareImgLinksAsync(dontResetDelay) {
            if (!options.extensionEnabled || isExcludedSite()) {
                return;
            }
            if (!dontResetDelay) {
                prepareImgLinksDelay = 500;
            }
            clearTimeout(prepareImgLinksTimeout);
            prepareImgLinksTimeout = setTimeout(function() {
                prepareImgLinks();
            }, prepareImgLinksDelay);
            prepareImgLinksDelay *= 2;
        }

        function deepUnescape(url) {
            var ueUrl = unescape(encodeURIComponent(url));
            while (url != ueUrl) {
                url = ueUrl;
                ueUrl = unescape(url);
            }
            return decodeURIComponent(escape(url));
        }

        function applyOptions() {
            init();
            if (!options.extensionEnabled || isExcludedSite()) {
                hideHoverZoomImg();
                jQuery(document).unbind('mousemove', documentMouseMove);
            }
        }

        var webSiteExcluded = null;

        function isExcludedSite() {
            if (webSiteExcluded != null) {
                return webSiteExcluded;
            }

            var excluded = !options.whiteListMode;
            var siteAddress = location.href.substr(location.protocol.length + 2);
            if (siteAddress.substr(0, 4) == 'www.') {
                siteAddress = siteAddress.substr(4);
            }
            for (var i = 0; i < options.excludedSites.length; i++) {
                var es = options.excludedSites[i];
                if (es.substr(0, 4) == 'www.') {
                    es = es.substr(4);
                }
                if (es && es.length <= siteAddress.length) {
                    if (siteAddress.substr(0, es.length) == es) {
                        webSiteExcluded = excluded;
                        return excluded;
                    }
                }
            }
            webSiteExcluded = !excluded;
            return !excluded;
        }

        function loadOptions() {
            var result = {
                extensionEnabled: true,
                showCaptions: true,
                showHighRes: true,
                addToHistory: true,
                alwaysPreload: false,
                displayDelay: 10,
                fadeDuration: 10,
                picturesOpacity: 1,
                showWhileLoading: false,
                mouseUnderlap: true,
                enableGalleries: false,
                excludedSites: []
            }
            options = result;
            if (options) {
                applyOptions();
            }
        }

        function windowOnDOMNodeInserted(mutations) {
            mutations.forEach(function(mutation) {
                for (var i = 0, l = mutation.addedNodes.length; i < l; i++) {
                    insertedNode = mutation.addedNodes[i];
                    if (insertedNode instanceof Text) {
                        continue;
                    }
                    if (insertedNode.nodeName === 'A' ||
                        insertedNode.nodeName === 'IMG' ||
                        insertedNode.getElementsByTagName('A').length > 0 ||
                        insertedNode.getElementsByTagName('IMG').length > 0 ||
                        insertedNode.className.indexOf('popup_box_container') >= 0) {
                        if (insertedNode.id !== 'hzImg' &&
                            insertedNode.parentNode && insertedNode.parentNode.id !== 'hzImg' &&
                            insertedNode.id !== 'hzDownscaled') {
                            prepareImgLinksAsync();
                        }
                    } else if (insertedNode.nodeName === 'EMBED' || insertedNode.nodeName === 'OBJECT') {
                        fixFlash();
                    }
                }
            });
        }

        function windowOnLoad(event) {
            prepareImgLinksAsync();
        }

        function bindEvents() {
            wnd.load(windowOnLoad).scroll(cancelImageLoading);

            var observer = new MutationObserver(windowOnDOMNodeInserted);
            observer.observe(document, {
                childList: true,
                subtree: true
            });
            window.addEventListener("beforeunload", function() {
                observer.disconnect();
            }, false);
            jQuery(document).mousemove(documentMouseMove).mouseleave(cancelImageLoading).mousedown(documentMouseDown).keydown(documentOnKeyDown).keyup(documentOnKeyUp);
        }

        function documentOnKeyDown(event) {
            if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(event.target.tagName) > -1) {
                return;
            }
            if (imgFullSize) {
                if (event.which == 84) {
                    openImageInTab(event.shiftKey);
                    return false;
                }
                if (event.which == 83) {
                    saveImage();
                    return false;
                }
                if (event.which == options.actionKey ||
                    event.which == options.fullZoomKey ||
                    event.which == options.hideKey) {
                    return false;
                }
                if (event.which == 37) {
                    rotateGalleryImg(-1);
                    return false;
                }
                if (event.which == 39) {
                    rotateGalleryImg(1);
                    return false;
                }
            }
        }

        function documentOnKeyUp(event) {
            if (event.which == options.actionKey) {
                actionKeyDown = false;
                hideHoverZoomImg();
            }
            if (event.which == options.fullZoomKey) {
                fullZoomKeyDown = false;
                jQuery(this).mousemove();
            }
            if (event.which == options.hideKey) {
                hideKeyDown = false;
                if (imgFullSize) {
                    hz.hzImg.show();
                }
                jQuery(this).mousemove();
            }
        }

        function fixFlash() {
            if (flashFixDomains.indexOf(location.host) == -1) {
                return;
            }
            if (isExcludedSite() || window == window.top && jQuery('.hoverZoomLink').length == 0) {
                return;
            }
            jQuery('embed:not([wmode]), embed[wmode="window"]').each(function() {
                if (!this.type || this.type.toLowerCase() != 'application/x-shockwave-flash') {
                    return;
                }
                var embed = this.cloneNode(true);
                embed.setAttribute('wmode', 'opaque');
                jQuery(this).replaceWith(embed);
            });
            var wmodeFilter = function() {
                return this.name.toLowerCase() == 'wmode';
            };
            jQuery('object[type="application/x-shockwave-flash"]').filter(function() {
                var param = jQuery(this).children('param').filter(wmodeFilter);
                return param.length == 0 || param.attr('value').toLowerCase() == 'window';
            }).each(function() {
                var object = this.cloneNode(true);
                jQuery(object).children('param').filter(wmodeFilter).remove();
                jQuery('<param name="wmode" value="opaque">').appendTo(object);
                jQuery(this).replaceWith(object);
            });
        }

        function getHostFromUrl(url) {
            var host = '';
            if (url.indexOf('://') > -1) {
                host = url.replace(/.+:\/\/([^\/]*).*/, '$1');
            } else {
                host = window.location.host;
            }
            var aHost = host.split('.'),
                maxItems = 2;
            if (aHost.length > 2) {
                var preTld = aHost[aHost.length - 2];
                if (preTld == 'co' || preTld == 'com' || preTld == 'net' || preTld == 'org') {
                    maxItems = 3;
                }
            }
            while (aHost.length > maxItems) {
                aHost.shift();
            }
            return aHost.join('.');
        }

        function openImageInTab(background) {
            alert("Tab!");
        }

        function saveImage() {
            var a = document.createElement('a');
            a.href = imgDetails.url;
            a.download = imgDetails.url.split('/').pop().split('?')[0];
            if (!a.download) {
                a.download = 'image.jpg';
            }

            a.click();
        }

        function rotateGalleryImg(rot) {

            var link = hz.currentLink,
                data = link.data();
            if (!data.hoverZoomGallerySrc) {
                return;
            }

            var l = data.hoverZoomGallerySrc.length;
            data.hoverZoomGalleryIndex = (data.hoverZoomGalleryIndex + rot + l) % l;
            updateImageFromGallery(link);

            data.hoverZoomSrcIndex = 0;
            loading = true;
            hzGallery.text('.../' + data.hoverZoomGallerySrc.length);

            loadNextGalleryImage();
            preloadGalleryImage((data.hoverZoomGalleryIndex + rot + l) % l);
        }

        function loadNextGalleryImage() {
            clearTimeout(loadFullSizeImageTimeout);
            imgDetails.url = hz.currentLink.data().hoverZoomSrc[hz.currentLink.data().hoverZoomSrcIndex];
            imgFullSize.load(nextGalleryImageOnLoad).error(function() {
                imgOnError(this, false, loadNextGalleryImage);
            }).attr('src', imgDetails.url);
        }

        function nextGalleryImageOnLoad() {
            if (loading) {
                loading = false;
                posImg();

                data = hz.currentLink.data();
                hzGallery.text((data.hoverZoomGalleryIndex + 1) + '/' + data.hoverZoomGallerySrc.length);
                if (options.showCaptions) {
                    $(hzCaption).text(data.hoverZoomCaption);
                }
            }
        }

        function updateImageFromGallery(link) {
            if (options.enableGalleries) {
                var data = link.data();
                data.hoverZoomSrc = data.hoverZoomGallerySrc[data.hoverZoomGalleryIndex];

                if (data.hoverZoomGalleryCaption) {
                    data.hoverZoomCaption = data.hoverZoomGalleryCaption[data.hoverZoomGalleryIndex];
                } else {
                    prepareImgCaption(link);
                }
            }
        }

        function preloadGalleryImage(index) {
            var preloadImg = new Image();
            preloadImg.src = hz.currentLink.data().hoverZoomGallerySrc[index][0];
        }

        function init() {
            if (!window.innerHeight || !window.innerWidth) {
                return;
            }

            webSiteExcluded = null;
            body100pct = (body.css('position') != 'static') ||
                (body.css('padding-left') == '0px' && body.css('padding-right') == '0px' && body.css('margin-left') == '0px' && body.css('margin-right') == '0px');
            hz.pageGenerator = jQuery('meta[name="generator"]').attr('content');

            prepareImgLinks();
            bindEvents();
            fixFlash();
        }

        loadOptions();
    },

    urlReplace: function(res, filter, search, replace, parentFilter) {
        jQuery(filter).each(function() {
            var _this = jQuery(this),
                link, url, thumbUrl;
            if (parentFilter) {
                link = _this.parents(parentFilter);
            } else {
                link = _this;
            }
            url = hoverZoom.getThumbUrl(this);
            if (!url) {
                return;
            }
            thumbUrl = url;
            if (Array.isArray(search)) {
                for (var i = 0; i < search.length; i++) {
                    url = url.replace(search[i], replace[i]);
                }
            } else {
                url = url.replace(search, replace);
            }
            url = unescape(url);
            if (thumbUrl == url) {
                return;
            }
            var data = link.data().hoverZoomSrc;
            if (Object.prototype.toString.call(data) === '[object Array]') {
                data.unshift(url);
            } else {
                data = [url];
            }
            link.data().hoverZoomSrc = data;
            res.push(link);
        });
    },

    getThumbUrl: function(el) {
        var compStyle = getComputedStyle(el.context),
            backgroundImage = compStyle ? compStyle.backgroundImage : 'none';
        if (backgroundImage != 'none') {
            return backgroundImage.replace(/.*url\s*\(\s*(.*)\s*\).*/i, '$1');
        } else {
            return el.src || el.href;
        }
    },

    displayPicFromElement: function(el) {
        hoverZoom.currentLink = el;
        jQuery(document).mousemove();
    },

    createHzImg: function(displayNow) {
        if (!hoverZoom.hzImg) {
            hoverZoom.hzImg = jQuery('<div id="hzImg"></div>').appendTo(document.body);

            hoverZoom.hzImg.click(function(event) {
                if (hoverZoom.currentLink && hoverZoom.currentLink.length) {
                    var simEvent = document.createEvent('MouseEvents');
                    simEvent.initMouseEvent('click', event.bubbles, event.cancelable, event.view, event.detail,
                        event.screenX, event.screenY, event.clientX, event.clientY,
                        event.ctrlKey, event.altKey, event.shiftKey, event.metaKey, event.button, null);
                    hoverZoom.currentLink[0].dispatchEvent(simEvent);
                }
            });

        }
        hoverZoom.hzImg.addClass('hzImgCss');
        hoverZoom.hzImg.empty();
        if (displayNow) {
            hoverZoom.hzImg.stop(true, true).fadeTo(options.fadeDuration, options.picturesOpacity);
        }
    },

    createImgLoading: function() {
        hoverZoom.imgLoading = hoverZoom.imgLoading || jQuery('<img src="' + files.loadimg + '" style="opacity: 0.8; padding: 0; margin: 0" />');
        hoverZoom.imgLoading.appendTo(hoverZoom.hzImg);
    },

    preloadImages: function() {
        var links = jQuery('.hoverZoomLink'),
            preloadIndex = 0,
            preloadDelay = 200;

        function preloadNextImage() {
            if (preloadIndex >= links.length) {
                return;
            }
            var link = links.eq(preloadIndex++);
            if (link.data().hoverZoomPreloaded) {
                preloadNextImage();
            } else {
                var hoverZoomSrcIndex = link.data().hoverZoomSrcIndex || 0;
                jQuery('<img src="' + link.data().hoverZoomSrc[hoverZoomSrcIndex] + '">').load(function() {
                    link.data().hoverZoomPreloaded = true;
                    setTimeout(function() {
                        preloadNextImage();
                    }, preloadDelay);
                }).error(function() {
                    if (hoverZoomSrcIndex < link.data().hoverZoomSrc.length - 1) {
                        link.data().hoverZoomSrcIndex++;
                        preloadIndex--;
                    }
                    setTimeout(function() {
                        preloadNextImage();
                    }, preloadDelay);
                });
            }
        }

        setTimeout(function() {
            preloadNextImage();
        }, preloadDelay);
    },

    prepareOEmbedLink: function(link, apiEndpoint, linkUrl) {
        if (!linkUrl) {
            linkUrl = getThumbUrl(link);
        }
        link = jQuery(link);
        jQuery.getJSON(apiEndpoint + linkUrl, function(data) {
            if (data && data.type == 'photo' && data.url) {
                link.data().hoverZoomSrc = [data.url];
                link.addClass('hoverZoomLink');
                hoverZoom.displayPicFromElement(link);
            }
        });
    },

    prepareFromDocument: function(link, url, getSrc) {
        jQuery.get(url, function(data) {
            var doc = document.createElement("div");
            doc.innerHTML = data;
            doc.getElementById = function(someId) {
                return doc.querySelector("#" + someId);
            }

            var httpRefresh = doc.querySelector('meta[http-equiv="refresh"][content]');
            if (httpRefresh) {
                var redirUrl = httpRefresh.content.substr(httpRefresh.content.toLowerCase().indexOf('url=') + 4);
                if (redirUrl) {
                    hoverZoom.prepareFromDocument(link, redirUrl, getSrc);
                }
            }

            var src = getSrc(doc);
            if (src) {
                link.data().hoverZoomSrc = [src];
                link.addClass('hoverZoomLink');
                hoverZoom.displayPicFromElement(link);
            }
        });
    }
};

(function($) {
    if (!$.support.cors && $.ajaxTransport && window.XDomainRequest) {
        var httpRegEx = /^https?:\/\//i;
        var getOrPostRegEx = /^get|post$/i;
        var sameSchemeRegEx = new RegExp('^' + location.protocol, 'i');
        var htmlRegEx = /text\/html/i;
        var jsonRegEx = /\/json/i;
        var xmlRegEx = /\/xml/i;

        $.ajaxTransport('* text html xml json', function(options, userOptions, jqXHR) {
            if (options.crossDomain && options.async && getOrPostRegEx.test(options.type) && httpRegEx.test(options.url) && sameSchemeRegEx.test(options.url)) {
                var xdr = null;
                var userType = (userOptions.dataType || '').toLowerCase();
                return {
                    send: function(headers, complete) {
                        xdr = new XDomainRequest();
                        if (/^\d+$/.test(userOptions.timeout)) {
                            xdr.timeout = userOptions.timeout;
                        }
                        xdr.ontimeout = function() {
                            complete(500, 'timeout');
                        };
                        xdr.onload = function() {
                            var allResponseHeaders = 'Content-Length: ' + xdr.responseText.length + '\r\nContent-Type: ' + xdr.contentType;
                            var status = {
                                code: 200,
                                message: 'success'
                            };
                            var responses = {
                                text: xdr.responseText
                            };
                            try {
                                if (userType === 'html' || htmlRegEx.test(xdr.contentType)) {
                                    responses.html = xdr.responseText;
                                } else if (userType === 'json' || (userType !== 'text' && jsonRegEx.test(xdr.contentType))) {
                                    try {
                                        responses.json = $.parseJSON(xdr.responseText);
                                    } catch (e) {
                                        status.code = 500;
                                        status.message = 'parseerror';
                                        //throw 'Invalid JSON: ' + xdr.responseText;
                                    }
                                } else if (userType === 'xml' || (userType !== 'text' && xmlRegEx.test(xdr.contentType))) {
                                    var doc = new ActiveXObject('Microsoft.XMLDOM');
                                    doc.async = false;
                                    try {
                                        doc.loadXML(xdr.responseText);
                                    } catch (e) {
                                        doc = undefined;
                                    }
                                    if (!doc || !doc.documentElement || doc.getElementsByTagName('parsererror').length) {
                                        status.code = 500;
                                        status.message = 'parseerror';
                                        throw 'Invalid XML: ' + xdr.responseText;
                                    }
                                    responses.xml = doc;
                                }
                            } catch (parseMessage) {
                                throw parseMessage;
                            } finally {
                                complete(status.code, status.message, responses, allResponseHeaders);
                            }
                        };
                        xdr.onprogress = function() {};
                        xdr.onerror = function() {
                            complete(500, 'error', {
                                text: xdr.responseText
                            });
                        };
                        var postData = '';
                        if (userOptions.data) {
                            postData = ($.type(userOptions.data) === 'string') ? userOptions.data : $.param(userOptions.data);
                        }
                        xdr.open(options.type, options.url);
                        xdr.send(postData);
                    },
                    abort: function() {
                        if (xdr) {
                            xdr.abort();
                        }
                    }
                };
            }
        });
    }
})(jQuery);
var currenthost = window['location']['hostname'];

var hoverZoomPlugins = hoverZoomPlugins || [];

function slice(a) {
    return Array.prototype.slice.call(a);
}

function qs(s) {
    return document.querySelector(s);
}

function qsa(s) {
    return document.querySelectorAll(s);
}

function ce(s) {
    return document.createElement(s);
}

function ge(s) {
    return document.getElementById(s);
}

function parentNodeName(e, tag) {
    var p = e.parentNode;
    if (!p) {
        return null;
    }
    if (p && p.nodeName == tag.toUpperCase()) {
        return p;
    } else {
        return parentNodeName(p, tag);
    }
}

if (currenthost.indexOf('vk.com') !== -1 && !hzInit) {

    hzInit = true;

    hoverZoomPlugins.push({
        name: 'VK.com',
        version: '0.1',
        listenerAdded: false,
        prepareImgLinks: function(callback) {
            if (!this.listenerAdded) {
                this.listenerAdded = true;
                chrome['runtime']['onMessage'].addListener(function listener(request, sender, sendResponse) {
                    switch (request.action) {
                        case "prepareFromScreenName":
                            prepareFromScreenNameCallback(request);
                            break;
                    }
                });
            }

            function prepareFromPhotoId(link, photoId, listId) {

                if (!listId) {
                    listId = 'photos' + photoId.match(/(\d+)_/)[1];
                }

                if (!window.location.origin) {
                    window['location'].origin = window['location'].protocol + "//" + window['location'].host;
                }
                jQuery.ajax({
                    type: 'POST',
                    url: window['location'].origin + "/al_photos.php?" + 'al=1&act=show&photo=' + photoId + '&list=' + listId,
                    async: true,
                    success: function(responce) {
                        if (!responce) {
                            getPhotoByIdVKAPI(link, photoId);
                        }
                        var photos;
                        try {
                            var j = responce.match(/<!json>(.*?)<!>/);
                            photos = JSON.parse(j[1]);
                        } catch (e) {
                            getPhotoByIdVKAPI(link, photoId);
                            return;
                        }
                        for (var i in photos) {
                            if (photos[i].id == photoId) {
                                if (link.data()) {
                                    link.data().hoverZoomSrc = [photos[i].w_src || photos[i].z_src || photos[i].y_src || photos[i].x_src];
                                    link.addClass('hoverZoomLink');
                                }
                            } else {
                                // in case the request fetched details on another photo on the page
                                var otherLink = jQuery('a[href^="/photo' + photos[i].id + '"]');
                                if (otherLink.length > 0) {
                                    otherLink.addClass('hoverZoomLink');
                                    otherLink.data().hoverZoomSrc = [photos[i].w_src || photos[i].z_src || photos[i].y_src || photos[i].x_src];
                                }
                            }
                        }

                        if (link.data() && !link.data().hoverZoomMouseLeft) {
                            hoverZoom.displayPicFromElement(link);
                        }
                    },
                    error: function(responce) {
                        var data = link.data() || {};
                        if (!data.hoverZoomSrc && data.hoverZoomRequested) {
                            data.hoverZoomRequested = false;
                        }
                    }
                });
            }

            function getPhotoByIdVKAPI(link, photoId) {
                jQuery.ajax({
                    type: 'POST',
                    url: "https://api.vk.com/method/photos.getById?photos=" + photoId,
                    async: true,
                    success: function(responce) {
                        if (responce) {
                            var photo_obj = responce;
                            if (photo_obj.response) {
                                photo_obj = photo_obj.response;
                            }
                            if (Array.isArray(photo_obj)) {
                                photo_obj = photo_obj[0];
                                var src = photo_obj.src_xxxbig || photo_obj.src_xxbig || photo_obj.src_xbig || photo_obj.src_big || null;
                                link.data().hoverZoomSrc = [src];
                                link.addClass('hoverZoomLink');
                                if (!link.data().hoverZoomMouseLeft) {
                                    hoverZoom.displayPicFromElement(link);
                                }
                            } else if (photo_obj.error) {
                                hoverZoom.prepareFromDocument(link, "https://m.vk.com/photo" + photoId, function(doc) {
                                    var src = doc.querySelector('.mv_actions li a.mva_item[href^="http"][target="_blank"]');
                                    if (!src) {
                                        src = doc.querySelector('.pv_body .ph_img');
                                        if (src) {
                                            src = src.getAttribute('src');
                                        }
                                    } else {
                                        src = src.getAttribute('href');
                                    }
                                    return src;
                                });
                            }
                        }
                    },
                    error: function(responce) {}
                });
            }

            function getAlbumThumbId(link, albumId, callback) {
                var ownerId;
                var albumId = albumId.match(/(-?\d+)_(\d+)/);
                if (albumId && albumId.length > 2) {
                    ownerId = albumId[1];
                    albumId = albumId[2];
                }
                if (ownerId && ownerId[0] == '-' && albumId.length > 4) {
                    jQuery.ajax({
                        type: 'GET',
                        url: "https://api.vk.com/method/photos.getAlbums?owner_id=" + ownerId + "&album_ids=" + albumId,
                        async: true,
                        success: function(response) {
                            if (response && response.response) {
                                var album_obj = response.response;
                                if (Array.isArray(album_obj) && album_obj.length > 0) {
                                    var thumbPhotoId = album_obj[0].owner_id + '_' + album_obj[0].thumb_id;
                                    callback && callback(link, thumbPhotoId);
                                }
                            }
                        },
                        error: function(response) {}
                    });
                } else if (ownerId) {
                    jQuery.ajax({
                        type: 'POST',
                        url: 'https://vk.com/al_photos.php?act=show_albums&al=1&owner=' + ownerId,
                        async: true,
                        success: function(responce) {
                            var doc = document.implementation.createHTMLDocument();
                            doc.open();
                            doc.write(responce);
                            doc.close();
                            var src = doc.querySelector('.photo_row[id^="album' + ownerId + '_' + albumId + '"] a, .photo_row#tag' + ownerId + '\\?albums\\=' + albumId + ' a');
                            if (src) {
                                var onclick = jQuery(src).attr('onclick');
                                if (onclick) {
                                    var baseLink = onclick.match(/base\"\:\"([\w.\/\:-]+)/)[1],
                                        links = onclick.match(/([\w.\/\:\-]+)(?=\"(?:\,\d|\]))/g),
                                        url = baseLink + links[links.length - 1] + '.jpg';
                                    link.data().hoverZoomSrc = [url];
                                    link.addClass('hoverZoomLink');
                                    hoverZoom.displayPicFromElement(link);
                                }
                            }
                        },
                        error: function() {}
                    });
                }
            }

            function prepareFromScreenNameCallback(data) {
                var link = jQuery("#" + data.link_id),
                    res = JSON.parse(data.res),
                    isGroup = data.isGroup,
                    screenName = data.screen_name;
                if (res.error) {
                    if (res.error.error_code == 113 && !isGroup) {
                        prepareFromScreenName(link, screenName, true);
                    } else {
                        console.error('[VKHZ] failed to get picture from id "' + screenName + '"!');
                    }
                    return false;
                } else if (res.response && res.response[0] && res.response[0].deactivated) {
                    var srcs = link.data().hoverZoomSrc || [];
                    srcs.unshift(link.attr('src'));
                    link.data().hoverZoomSrc = srcs;
                    link.addClass('hoverZoomLink');
                    hoverZoom.displayPicFromElement(link);
                    return false;
                } else if (link.data()) {
                    var resp = res.response[0];
                    if (resp) {
                        if (!isGroup) {
                            var photo_id = resp.photo_id;
                            prepareFromPhotoId(link, photo_id);
                        } else {
                            link.data().hoverZoomSrc = [resp.photo_big];
                            link.addClass('hoverZoomLink');
                        }
                    }

                    if (!link.data().hoverZoomMouseLeft) {
                        hoverZoom.displayPicFromElement(link);
                    }
                }
            }
            function prepareFromScreenName(link, screenName, isGroup) {
                if (screenName == null) {
                    return;
                }
                if (!link.attr('id')) {
                    link.attr('id', 'link' + link_counter);
                    link_counter++;
                }
                if (isGroup) {
                    hoverZoom.prepareFromDocument(link, 'https://vk.com/' + screenName, function(doc) {
                        var href = doc.querySelector('a.page_cover_image, #page_avatar>a, img.page_avatar_img');
                        if (href) {
                            href = href.getAttribute('href') || href.getAttribute('src');
                            var photo_id = href.match(/\/photo(-?\d+_\d+).*/);
                            if (photo_id && photo_id.length > 1) {
                                prepareFromPhotoId(link, photo_id[1]);
                            } else {
                                link.data().hoverZoomSrc = [link.find('img').attr('src')];
                                link.addClass('hoverZoomLink');
                                hoverZoom.displayPicFromElement(link);
                            }
                        }

                        return null;
                    });
                } else {
                    chrome['runtime'].sendMessage({
                        action: "prepareFromScreenName",
                        screen_name: screenName,
                        link_id: link.attr('id')
                    });
                }
                setTimeout(function() {
                    var data = link.data() || {};
                    if (!data.hoverZoomSrc && data.hoverZoomRequested) {
                        data.hoverZoomRequested = false;
                    }
                }, 1000);
            };
            jQuery('a.photos_choose_row.fl_l').mouseenter(function() {
                var link = jQuery(this),
                    data = link.data();
                if (data.hoverZoomRequested || data.hoverZoomSrc) {
                    return;
                }
                data.hoverZoomRequested = true;

                var script = link.attr('onclick');
                script = script.match(/{.*}/);
                script = JSON.parse(script);

                if (script && script.editable && script.editable.sizes) {
                    var sizes = script.editable.sizes;
                    var url = sizes.x || sizes.s || sizes.r || sizes.q;

                    if (url[0]) {
                        link.data().hoverZoomSrc = [url[0]];
                        link.addClass('hoverZoomLink');
                    }
                }
            }).mouseleave(function() {
                jQuery(this).data().hoverZoomMouseLeft = true;
            });

            jQuery('a img.market_row_img, a img.fave_market_img').mouseenter(function() {
                var link = jQuery(this),
                    data = link.data();
                if (data.hoverZoomRequested || data.hoverZoomSrc) {
                    return;
                }
                data.hoverZoomRequested = true;
                var href = link.closest('a').attr('href');
                var itemId = href.match(/\?w=([^&]+)/);
                if (itemId && itemId.length > 1) {
                    itemId = itemId[1];
                    hoverZoom.prepareFromDocument(link, 'https://vk.com/wkview.php?act=show&al=1&loc=market&w=' + itemId, function(doc) {
                        var photo = doc.getElementById('market_item_photo');
                        return photo.getAttribute('src');
                    });
                }
            }).mouseleave(function() {
                jQuery(this).data().hoverZoomMouseLeft = true;
            });

            jQuery('a[id*="photos_choose_row"], img[class*="fc_photo_thumb"]').mouseenter(function() {
                var link = jQuery(this),
                    data = link.data();
                if (data.hoverZoomRequested || data.hoverZoomSrc) {
                    return;
                }
                data.hoverZoomRequested = true;
                var l_href = this.href;
                l_href = l_href.split("photo");
                l_href = l_href[1];
                var photoId = l_href;
                prepareFromPhotoId(link, photoId);
            }).mouseleave(function() {
                jQuery(this).data().hoverZoomMouseLeft = true;
            });
            jQuery('a[class*="page_post_thumb"], a[class*="photo"], .photo_row>a.img_link').mouseenter(function() {
                var link = jQuery(this),
                    data = link.data();
                if (data.hoverZoomSrc || data.hoverZoomRequested) {
                    return;
                }
                data.hoverZoomRequested = true;
                var onclick = jQuery(this).attr('onclick');
                if (onclick) {
                    if (onclick.indexOf('showPhoto') == -1) {
                        var album = this.pathname && this.pathname.match(/^\/(?:album|tag)([\d_-]+)/);
                        var album_id = this.search && this.search.match(/^\?albums=([\d_-]+)/);
                        if (album && album.length > 1) {
                            if (album_id && album_id.length > 1) album[1] += '_' + album_id[1];
                            getAlbumThumbId(link, album[1], prepareFromPhotoId);
                        }
                        return;
                    }
                    var baseLink = onclick.match(/base\"\:\"([\w.\/\:-]+)/)[1], // extract first part of direct link to image
                        links = onclick.match(/([\w.\/\:\-]+)(?=\"(?:\,\d|\]))/g), // extract second parts
                        url = baseLink + links[links.length - 1] + '.jpg';

                    data.hoverZoomSrc = [url];
                    link.addClass('hoverZoomLink');

                    if (!link.data().hoverZoomMouseLeft) {
                        hoverZoom.displayPicFromElement(link);
                    }
                } else {
                    var userId = this.href.match(/vk\.com\/([^?]+)/);
                    if (userId && userId.length > 1) {
                        userId = userId[1];
                        prepareFromScreenName(link, userId, false);
                    }
                }
            }).mouseleave(function() {
                jQuery(this).data().hoverZoomMouseLeft = true;
            });

            jQuery('a[href^="/photo"]').mouseenter(function() {
                var link = jQuery(this),
                    data = link.data();
                if (data.hoverZoomSrc || this.id == "pv_photo") {
                    return;
                }
                if (this.onclick) {
                    var onclick = this.onclick.toString();
                    if (onclick.indexOf('x_src:') > -1) {
                        data.hoverZoomSrc = [onclick.match(/x_src\s*:\s*"([^"]*)"/)[1]];
                        link.addClass('hoverZoomLink');
                    }
                }

                if (data.hoverZoomSrc || data.hoverZoomRequested) {
                    return;
                }
                data.hoverZoomRequested = true;
                var listId, photoId = this.href.match(/\/photo(-?\d+_\d+).*/)[1];
                if (this.href.indexOf('tag=') > -1) {
                    listId = 'tag' + this.href.match(/tag=(\d+)/)[1];
                }
                prepareFromPhotoId(link, photoId, listId);
            }).mouseleave(function() {
                jQuery(this).data().hoverZoomMouseLeft = true;
            });

            jQuery('a[id="profile_photo_link"]').mouseenter(function() {
                if (this.href.length != 0) return;
                var link = jQuery(this),
                    data = link.data();
                if (data.hoverZoomSrc || data.hoverZoomRequested) {
                    return;
                }
                data.hoverZoomRequested = true;
                var userId = location.pathname.substring(1);
                prepareFromScreenName(link, userId, false);
            }).mouseleave(function() {
                jQuery(this).data().hoverZoomMouseLeft = true;
            });

            jQuery('img.top_profile_img').mouseenter(function() {
                var link = jQuery(this),
                    data = link.data();
                if (data.hoverZoomSrc || data.hoverZoomRequested) {
                    return;
                }
                var profile_link = link.closest('a#top_profile_link');
                if (profile_link.length) {
                    data.hoverZoomRequested = true;
                    var userId = profile_link[0].pathname.substring(1);
                    prepareFromScreenName(link, userId, false);
                }
            }).mouseleave(function() {
                jQuery(this).data().hoverZoomMouseLeft = true;
            });

            jQuery('a:not(#top_profile_link)').filter(function() {
                var h = this.href;
                var s = this.search;
                if (h.length > 0 && (s.length == 0 || s == '?from=top' || s.indexOf('?owner=-') == 0) && h.indexOf('/photo') == -1 &&
                    (this.getElementsByTagName('img').length > 0 || this.querySelector('.ow_ava')) && !jQuery(this).is('#top_notify_btn')) {
                    return true;
                }
            }).mouseenter(function() {
                var link = jQuery(this),
                    data = link.data();
                if (data.hoverZoomSrc || data.hoverZoomRequested) {
                    return;
                }
                data.hoverZoomRequested = true;
                var userId = this.pathname;
                if (userId) {
                    userId = userId.replace('/', '');
                }
                var params = this.search;
                if (params.indexOf('?owner=-') == 0) {
                    userId = params;
                }

                var album = userId.match(/^album([\d_-]+)/);
                var wall_link = userId.match(/^wall([\d_-]+)/);
                if (album && album.length > 1) {
                    getAlbumThumbId(link, album[1], prepareFromPhotoId);
                } else if (wall_link && wall_link.length > 1) {
                    hoverZoom.prepareFromDocument(link, "https://m.vk.com/" + userId, function(doc) {
                        var src = doc.querySelector('#' + userId + ' .thumb_map_img');
                        if (src) {
                            src = src.getAttribute('data-src_big');
                            src = src.split('|');
                            return src[0];
                        }
                    });
                } else {
                    prepareFromScreenName(link, userId, false);
                }

            }).mouseleave(function() {
                jQuery(this).data().hoverZoomMouseLeft = true;
            });

            jQuery('.audio_catalog_performer_thumb').mouseenter(function() {
                var link = jQuery(this),
                    data = link.data();
                if (data.hoverZoomSrc || data.hoverZoomRequested) {
                    return;
                }
                data.hoverZoomRequested = true;

                var bg = link.css('background-image');
                if (bg) {
                    bg = bg.match(/\(.*\)/);
                    bg = bg[0].substring(2, bg[0].length - 2);
                    if (bg) {
                        link.data().hoverZoomSrc = [bg];
                        link.addClass('hoverZoomLink');
                    }
                }
            }).mouseleave(function() {
                jQuery(this).data().hoverZoomMouseLeft = true;
            });

            jQuery('img[class*="audio_friend_photo"], .audio_friend>.ow_ava.ow_ava_small.fl_l').mouseenter(function() {
                var img = jQuery(this),
                    data = img.data();
                if (data.hoverZoomRequested || data.hoverZoomSrc) {
                    return;
                }
                data.hoverZoomRequested = true;
                var p = this.parentNode;
                while (p.id.indexOf('audio_friend') == -1) {
                    p = p.parentNode;
                }
                var uid = p.id.match(/([\d]+)/)[1];
                prepareFromScreenName(img, uid, false);
            }).mouseleave(function() {
                jQuery(this).data().hoverZoomMouseLeft = true;
            });

            jQuery('.nim-dialog._im_dialog ._im_dialog_photo img').mouseenter(function() {
                var img = jQuery(this),
                    data = img.data();
                if (data.hoverZoomRequested || data.hoverZoomSrc) {
                    return;
                }
                data.hoverZoomRequested = true;
                var p = this.parentNode;
                while (!p.getAttribute('data-list-id')) {
                    p = p.parentNode;
                }
                var uid = p.getAttribute('data-list-id');
                prepareFromScreenName(img, uid, false);
            }).mouseleave(function() {
                jQuery(this).data().hoverZoomMouseLeft = true;
            });

            jQuery('img[src*="/u"]').filter(function() {
                return this.src.match(/\/u\d+\/[ed]_/);
            }).mouseenter(function() {
                //console.log('img found!');
                var img = jQuery(this),
                    data = img.data();
                if (data.hoverZoomRequested || data.hoverZoomSrc) {
                    return;
                }
                data.hoverZoomRequested = true;
                var userId = this.src.match(/\/u(\d+)\//)[1];
                if (!window['location'].origin) {
                    window['location'].origin = window['location'].protocol + "//" + window['location'].host;
                }
                jQuery.ajax({
                    type: 'GET',
                    url: window['location'].origin + '/al_photos.php?' + '/al_profile.php?al=1&act=get_profile_photos&offset=0&skip_one=0&id=' + userId,
                    async: true,
                    success: function(responce) {
                        if (!responce) {
                            var data = img.data();
                            if (!data.hoverZoomSrc && data.hoverZoomRequested) {
                                data.hoverZoomRequested = false;
                            }
                        }
                        var photos;
                        try {
                            photos = JSON.parse(response.match(/<!json>(.*)$/)[1]);
                        } catch (e) {
                            return;
                        }
                        if (photos.length) {
                            prepareFromPhotoId(img, photos[0][1].match(/\/photo(\d+_\d+)/)[1], '');
                        } else {
                            var data = link.data();
                            if (!data.hoverZoomSrc && data.hoverZoomRequested) {
                                data.hoverZoomRequested = false;
                            }
                        }
                    },
                    error: function(responce) {
                        var data = img.data();
                        if (!data.hoverZoomSrc && data.hoverZoomRequested) {
                            data.hoverZoomRequested = false;
                        }
                    }
                });
            }).mouseleave(function() {
                jQuery(this).data().hoverZoomMouseLeft = true;
            });

            jQuery('.group_friends_image').mouseenter(function() {
                var link = jQuery(this),
                    data = link.data();
                if (data.hoverZoomSrc || data.hoverZoomRequested) {
                    return;
                }
                data.hoverZoomRequested = true;
                var userId = link[0].pathname.substring(1);
                prepareFromScreenName(link, userId, false);
            }).mouseleave(function() {
                jQuery(this).data().hoverZoomMouseLeft = true;
            });
        }
    });
}

hoverZoom.loadHoverZoom();