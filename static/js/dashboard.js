/* Dashboard Logic - Multi-Select V3 */
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('post-search');
    const grid = document.getElementById('posts-grid');
    if (!grid) return;

    const cards = Array.from(document.querySelectorAll('.post-card'));
    const noResults = document.getElementById('no-results');
    const sortBtns = document.querySelectorAll('.sort-btn');
    const advancedSection = document.getElementById('advanced-filters');
    const advBtn = document.getElementById('adv-filter-btn');

    // === STATE (Multi-Select Sets) ===
    const state = {
        search: '',
        tags: new Set(),      // Set<string>
        categories: new Set(),// Set<string>
        years: new Set(),     // Set<string>
        times: new Set()      // Set<string>
    };

    // === EVENT LISTENERS ===

    // Search
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.search = e.target.value.toLowerCase().trim();
            applyFilters();
        });
    }

    // Toggle Advanced Filters
    window.toggleAdvancedFilters = function () {
        if (advancedSection.style.display === 'none') {
            advancedSection.style.display = 'block';
            advBtn.classList.add('bg-gray-100', 'dark:bg-white/10');
            advBtn.innerHTML = '<ion-icon name="close"></ion-icon> Close Filters';
        } else {
            advancedSection.style.display = 'none';
            advBtn.classList.remove('bg-gray-100', 'dark:bg-white/10');
            advBtn.innerHTML = '<ion-icon name="options"></ion-icon> Filters +';
        }
    }

    // === TOGGLE ACTIONS (Multi-Select) ===

    window.filterByTag = function (tag) {
        toggleSet(state.tags, tag);
        updateActiveButtons('.tag-filter:not(.time-filter):not(.year-filter):not(.category-filter)', 'data-tag', state.tags);
        applyFilters();
    };

    window.filterByCategory = function (cat) {
        toggleSet(state.categories, cat);
        updateActiveButtons('.category-filter', 'data-cat', state.categories);
        applyFilters();
    };

    window.filterByYear = function (year) {
        toggleSet(state.years, year);
        updateActiveButtons('.year-filter', 'data-year', state.years);
        applyFilters();
    };

    window.filterByTime = function (time) {
        toggleSet(state.times, time);
        updateActiveButtons('.time-filter', 'data-time', state.times);
        applyFilters();
    };

    window.resetFilters = function () {
        state.search = '';
        state.tags.clear();
        state.categories.clear();
        state.years.clear();
        state.times.clear();

        if (searchInput) searchInput.value = '';

        // Reset Logic: Clearing sets effectively resets to "All" behavior logic-wise
        // But we need to update UI to show "All" as active
        updateActiveButtons('.tag-filter', 'data-tag', state.tags);
        updateActiveButtons('.category-filter', 'data-cat', state.categories);
        updateActiveButtons('.year-filter', 'data-year', state.years);
        updateActiveButtons('.time-filter', 'data-time', state.times);

        applyFilters();
    };


    // === HELPER LOGIC ===

    function toggleSet(set, value) {
        if (value === 'all') {
            set.clear(); // "All" clears specific filters -> implies show everything
        } else {
            if (set.has(value)) {
                set.delete(value);
            } else {
                set.add(value);
            }
        }
    }

    // Updates buttons. 
    // If set is empty, it means "All" is effectively active (default state).
    function updateActiveButtons(selector, dataAttr, set) {
        document.querySelectorAll(selector).forEach(btn => {
            const val = btn.getAttribute(dataAttr);

            // Logic: 
            // - If button is "all": Active if set is empty
            // - If button is specific: Active if set has it

            let isActive = false;
            if (val === 'all') {
                isActive = (set.size === 0);
            } else {
                isActive = set.has(val);
            }

            if (isActive) {
                btn.classList.add('active');
                btn.style.backgroundColor = '#6366f1';
                btn.style.color = 'white';
            } else {
                btn.classList.remove('active');
                btn.style.backgroundColor = '';
                btn.style.color = '';
            }
        });
    }

    function applyFilters() {
        let visibleCount = 0;

        cards.forEach(card => {
            // 1. Get Data
            const title = (card.dataset.title || '').toLowerCase();
            const cardTags = (card.dataset.tags || '').toLowerCase();
            const cardCats = (card.dataset.categories || '').toLowerCase();
            const summary = (card.dataset.summary || '').toLowerCase();
            const year = card.dataset.year || '';
            const readTime = parseInt(card.dataset.readtime || '1');

            // 2. Search Logic (Smart)
            const matchesSearch = !state.search ||
                title.includes(state.search) ||
                cardTags.includes(state.search) ||
                cardCats.includes(state.search) ||
                summary.includes(state.search);

            // 3. Multi-Select Logic (OR within group, AND between groups)
            // Empty set means "All" / Ignore filter

            // Check Tags (OR)
            const matchesTag = state.tags.size === 0 || [...state.tags].some(t => cardTags.includes(t));

            // Check Categories (OR)
            const matchesCat = state.categories.size === 0 || [...state.categories].some(c => cardCats.includes(c));

            // Check Years (OR)
            const matchesYear = state.years.size === 0 || state.years.has(year);

            // Check Time (OR)
            let matchesTime = false;
            if (state.times.size === 0) {
                matchesTime = true;
            } else {
                // If ANY selected time range matches
                if (state.times.has('short') && readTime < 5) matchesTime = true;
                if (state.times.has('medium') && readTime >= 5 && readTime <= 10) matchesTime = true;
                if (state.times.has('long') && readTime > 10) matchesTime = true;
            }

            // 4. Final Decision
            if (matchesSearch && matchesTag && matchesCat && matchesYear && matchesTime) {
                card.style.display = 'flex';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        // Toggle No Results
        if (noResults) {
            noResults.style.display = visibleCount === 0 ? 'block' : 'none';
        }
    }

    // Sort Logic (Preserved)
    window.sortPosts = function (order) {
        const sorted = cards.sort((a, b) => {
            const dateA = parseInt(a.dataset.date);
            const dateB = parseInt(b.dataset.date);
            return order === 'newest' ? dateB - dateA : dateA - dateB;
        });

        sorted.forEach(card => grid.appendChild(card));

        sortBtns.forEach(btn => {
            const isMatch = btn.innerText.toLowerCase() === order;
            btn.classList.toggle('active', isMatch);
            btn.style.backgroundColor = isMatch ? '#6366f1' : '#fff';
            btn.style.color = isMatch ? 'white' : '#555';
            if (document.documentElement.classList.contains('dark') && !isMatch) {
                btn.style.backgroundColor = 'transparent';
                btn.style.color = '#ccc';
            }
        });
    }
});
