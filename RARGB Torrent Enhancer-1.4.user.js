// ==UserScript==
// @name         _RARGB Torrent Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Add multiple thumbnails and magnet links to RARGB torrent listings with hover preview
// @author       Your Name
// @match        https://rargb.to/*
// @match        http://rargb.to/*
// @icon         https://rargb.to/favicon.ico
// @grant        GM_xmlhttpRequest
// @connect      rargb.to
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Cache for storing fetched torrent details
    const detailsCache = {};

    /**
     * Extract torrent ID from URL
     */
    function extractTorrentId(url) {
        const match = url.match(/\/torrent\/[^\/]+-(\d+)\.html/);
        return match ? match[1] : null;
    }

    /**
     * Fetch torrent details page
     */
    function fetchTorrentDetails(url) {
        return new Promise((resolve, reject) => {
            if (detailsCache[url]) {
                resolve(detailsCache[url]);
                return;
            }

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: function(response) {
                    if (response.status === 200) {
                        detailsCache[url] = response.responseText;
                        resolve(response.responseText);
                    } else {
                        reject(new Error(`HTTP ${response.status}`));
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Extract thumbnail URLs from torrent detail page
     */
    function extractThumbnails(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const thumbnails = [];

        // Look for images in the description
        const descriptionCell = doc.querySelector('#description');
        if (descriptionCell) {
            const images = descriptionCell.querySelectorAll('img.descrimg, img.img-responsive');
            images.forEach(img => {
                if (img.src && !img.src.includes('icon') && !img.src.includes('logo')) {
                    thumbnails.push(img.src);
                }
            });
        }

        return thumbnails;
    }

    /**
     * Extract magnet link from torrent detail page
     */
    function extractMagnetLink(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Find magnet link
        const magnetLink = doc.querySelector('a[href^="magnet:"]');
        if (magnetLink) {
            return magnetLink.href;
        }

        return null;
    }

    /**
     * Add thumbnail column header
     */
    function addThumbnailHeader() {
        const headerRow = document.querySelector('table.lista2t tr');
        if (!headerRow) return;

        // Check if thumbnail header already exists
        if (headerRow.querySelector('.thumbnail-header')) return;

        // Add thumbnail header after category icon
        const firstCell = headerRow.querySelector('td:first-child');
        if (firstCell) {
            const thumbnailHeader = document.createElement('td');
            thumbnailHeader.className = 'header6 header40 thumbnail-header';
            thumbnailHeader.style.width = '120px';
            thumbnailHeader.align = 'center';
            thumbnailHeader.textContent = 'Thumbnail';

            firstCell.parentNode.insertBefore(thumbnailHeader, firstCell.nextSibling);
        }
    }

    /**
     * Add magnet link column header
     */
    function addMagnetHeader() {
        const headerRow = document.querySelector('table.lista2t tr');
        if (!headerRow) return;

        // Check if magnet header already exists
        if (headerRow.querySelector('.magnet-header')) return;

        // Add magnet header before uploader
        const uploaderCell = headerRow.querySelector('td:last-child');
        if (uploaderCell) {
            const magnetHeader = document.createElement('td');
            magnetHeader.className = 'header6 header40 magnet-header';
            magnetHeader.style.width = '80px';
            magnetHeader.align = 'center';
            magnetHeader.textContent = 'Download';

            uploaderCell.parentNode.insertBefore(magnetHeader, uploaderCell);
        }
    }

    /**
     * Process torrent row
     */
    async function processTorrentRow(row) {
        // Skip if already processed
        if (row.classList.contains('enhanced')) return;
        row.classList.add('enhanced');

        const titleLink = row.querySelector('td:nth-child(2) a[href^="/torrent/"]');
        if (!titleLink) return;

        const torrentUrl = 'https://rargb.to' + titleLink.getAttribute('href');

        try {
            // Fetch torrent details
            const html = await fetchTorrentDetails(torrentUrl);
            const thumbnailUrls = extractThumbnails(html);
            const magnetLink = extractMagnetLink(html);

            // Add thumbnail cell
            const firstCell = row.querySelector('td:first-child');
            if (firstCell && thumbnailUrls.length > 0) {
                const thumbnailCell = document.createElement('td');
                thumbnailCell.className = 'lista thumbnail-cell';
                thumbnailCell.align = 'left';
                thumbnailCell.style.cssText = `
                    padding: 5px;
                    white-space: nowrap;
                    vertical-align: middle;
                    max-height: 200px;
                    overflow: hidden;
                    text-align: left;
                `;

                const container = document.createElement('div');
                container.style.cssText = `
                    display: inline-flex;
                    gap: 3px;
                    align-items: center;
                    height: 100%;
                    max-height: 200px;
                `;

                // Display up to 5 thumbnails in the table
                const maxThumbnails = Math.min(5, thumbnailUrls.length);
                for (let i = 0; i < maxThumbnails; i++) {
                    const img = document.createElement('img');
                    img.src = thumbnailUrls[i];
                    img.style.cssText = `
                        max-height: 200px;
                        max-width: 200px;
                        height: auto;
                        width: auto;
                        object-fit: contain;
                        border-radius: 3px;
                        border: 1px solid #ddd;
                        display: block;
                        cursor: pointer;
                    `;
                    img.title = `Image ${i + 1}/${thumbnailUrls.length} - Click to download with magnet`;

                    // Add click handler to download with magnet
                    if (magnetLink) {
                        img.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            window.location.href = magnetLink;
                        });
                    }

                    container.appendChild(img);
                }

                // Add indicator if there are more than 5 images
                if (thumbnailUrls.length > 5) {
                    const moreIndicator = document.createElement('span');
                    moreIndicator.style.cssText = `
                        font-size: 11px;
                        color: #666;
                        margin-left: 5px;
                        font-weight: bold;
                        white-space: nowrap;
                    `;
                    moreIndicator.textContent = `+${thumbnailUrls.length - 5}`;
                    moreIndicator.title = `${thumbnailUrls.length} images total`;
                    container.appendChild(moreIndicator);
                }

                thumbnailCell.appendChild(container);
                firstCell.parentNode.insertBefore(thumbnailCell, firstCell.nextSibling);

                // Attach hover events to show ALL thumbnails in preview
                attachRowHoverEvents(row, thumbnailUrls);
            } else if (firstCell) {
                // Add empty cell if no thumbnail
                const thumbnailCell = document.createElement('td');
                thumbnailCell.className = 'lista thumbnail-cell';
                thumbnailCell.align = 'left';
                thumbnailCell.textContent = '-';
                firstCell.parentNode.insertBefore(thumbnailCell, firstCell.nextSibling);
            }

            // Add magnet link cell
            const uploaderCell = row.querySelector('td:last-child');
            if (uploaderCell && magnetLink) {
                const magnetCell = document.createElement('td');
                magnetCell.className = 'lista magnet-cell';
                magnetCell.align = 'center';

                const magnetButton = document.createElement('a');
                magnetButton.href = magnetLink;
                magnetButton.title = 'Download with magnet link';
                magnetButton.innerHTML = '<img src="/static/img/magnet.gif" border="0" alt="Magnet">';

                magnetCell.appendChild(magnetButton);
                uploaderCell.parentNode.insertBefore(magnetCell, uploaderCell);
            } else if (uploaderCell) {
                // Add empty cell if no magnet link
                const magnetCell = document.createElement('td');
                magnetCell.className = 'lista magnet-cell';
                magnetCell.align = 'center';
                magnetCell.textContent = '-';
                uploaderCell.parentNode.insertBefore(magnetCell, uploaderCell);
            }

        } catch (error) {
            console.error('Error processing torrent row:', error);

            // Add empty cells on error
            const firstCell = row.querySelector('td:first-child');
            if (firstCell && !row.querySelector('.thumbnail-cell')) {
                const thumbnailCell = document.createElement('td');
                thumbnailCell.className = 'lista thumbnail-cell';
                thumbnailCell.align = 'left';
                thumbnailCell.textContent = '⚠';
                thumbnailCell.title = 'Error loading thumbnail';
                firstCell.parentNode.insertBefore(thumbnailCell, firstCell.nextSibling);
            }

            const uploaderCell = row.querySelector('td:last-child');
            if (uploaderCell && !row.querySelector('.magnet-cell')) {
                const magnetCell = document.createElement('td');
                magnetCell.className = 'lista magnet-cell';
                magnetCell.align = 'center';
                magnetCell.textContent = '⚠';
                magnetCell.title = 'Error loading magnet link';
                uploaderCell.parentNode.insertBefore(magnetCell, uploaderCell);
            }
        }
    }

    /**
     * Process all torrent rows with rate limiting
     */
    async function processAllRows() {
        const rows = document.querySelectorAll('table.lista2t tr.lista2');

        // Process rows with delay to avoid overwhelming the server
        for (let i = 0; i < rows.length; i++) {
            await processTorrentRow(rows[i]);
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    /**
     * Create floating preview container
     */
    function createPreviewContainer() {
        const preview = document.createElement('div');
        preview.id = 'rargb-preview';
        preview.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            max-width: 50vw;
            max-height: 90vh;
            z-index: 10000;
            display: none;
            background: white;
            border: 2px solid #333;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            padding: 10px;
            pointer-events: none;
            overflow-y: auto;
            overflow-x: hidden;
        `;

        const container = document.createElement('div');
        container.id = 'rargb-preview-container';
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
            align-items: stretch;
        `;

        preview.appendChild(container);
        document.body.appendChild(preview);

        return preview;
    }

    /**
     * Show preview on row hover
     */
    function attachRowHoverEvents(row, thumbnailUrls) {
        if (!thumbnailUrls || thumbnailUrls.length === 0) return;

        const preview = document.getElementById('rargb-preview');
        const container = document.getElementById('rargb-preview-container');

        row.addEventListener('mouseenter', function() {
            if (preview && container) {
                // Clear previous images
                container.innerHTML = '';

                // Calculate max dimensions (25% of screen)
                const maxWidth = window.innerWidth * 0.25;
                const maxHeight = window.innerHeight * 0.25;

                // Add all thumbnails
                thumbnailUrls.forEach(url => {
                    const imgWrapper = document.createElement('div');
                    imgWrapper.style.cssText = `
                        width: 100%;
                        display: flex;
                        justify-content: flex-start;
                    `;

                    const img = document.createElement('img');
                    img.src = url;

                    // Load image to get natural dimensions
                    img.onload = function() {
                        const naturalWidth = this.naturalWidth;
                        const naturalHeight = this.naturalHeight;
                        const aspectRatio = naturalHeight / naturalWidth;

                        let displayWidth = naturalWidth;
                        let displayHeight = naturalHeight;

                        // Limit to 25% of screen width
                        if (displayWidth > maxWidth) {
                            displayWidth = maxWidth;
                            displayHeight = maxWidth * aspectRatio;
                        }

                        // Limit to 25% of screen height
                        if (displayHeight > maxHeight) {
                            displayHeight = maxHeight;
                            displayWidth = maxHeight / aspectRatio;
                        }

                        // Ensure minimum 400px width, scale proportionally
                        if (displayWidth < 400) {
                            displayWidth = 400;
                            displayHeight = 400 * aspectRatio;

                            // Re-check if height exceeds 25% after scaling
                            if (displayHeight > maxHeight) {
                                displayHeight = maxHeight;
                                displayWidth = maxHeight / aspectRatio;
                            }
                        }

                        this.style.width = displayWidth + 'px';
                        this.style.height = displayHeight + 'px';
                    };

                    img.style.cssText = `
                        min-width: 400px;
                        max-width: 25vw;
                        max-height: 25vh;
                        height: auto;
                        display: block;
                        border-radius: 4px;
                        object-fit: contain;
                    `;

                    imgWrapper.appendChild(img);
                    container.appendChild(imgWrapper);
                });

                preview.style.display = 'block';
                // Reset scroll position
                preview.scrollTop = 0;
            }
        });

        row.addEventListener('mouseleave', function() {
            if (preview) {
                preview.style.display = 'none';
            }
        });
    }

    /**
     * Initialize the script
     */
    function init() {
        // Check if we're on a listing page
        const table = document.querySelector('table.lista2t');
        if (!table) return;

        // Add custom styles
        const style = document.createElement('style');
        style.textContent = `
            .thumbnail-cell {
                min-width: 120px;
                white-space: nowrap !important;
                vertical-align: middle !important;
                text-align: left !important;
            }
            .thumbnail-cell img {
                border: 1px solid #ddd;
                border-radius: 4px;
                cursor: pointer;
            }
            .thumbnail-cell img:hover {
                border-color: #4CAF50;
                box-shadow: 0 0 5px rgba(76, 175, 80, 0.5);
            }
            tr.lista2 {
                height: auto;
                max-height: 200px;
            }
            .magnet-cell a {
                display: inline-block;
                transition: transform 0.2s;
            }
            .magnet-cell a:hover {
                transform: scale(1.2);
            }
            tr.lista2 {
                transition: background-color 0.2s;
            }
            tr.lista2:hover {
                background-color: rgba(255, 255, 200, 0.3) !important;
            }
            #rargb-preview::-webkit-scrollbar {
                width: 10px;
            }
            #rargb-preview::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 8px;
            }
            #rargb-preview::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 8px;
            }
            #rargb-preview::-webkit-scrollbar-thumb:hover {
                background: #555;
            }
        `;
        document.head.appendChild(style);

        // Create preview container
        createPreviewContainer();

        // Add headers
        addThumbnailHeader();
        addMagnetHeader();

        // Process rows
        processAllRows();
    }

    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();