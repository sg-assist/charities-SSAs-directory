'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, AlertCircle, ExternalLink, Phone, Mail, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';

interface Organisation {
  id: string;
  name: string;
  slug: string;
  type: string;
  categories: string[];
  description: string;
  address: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  registrationNo: string | null;
  lastVerified: string | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ORG_TYPES = [
  { value: '', label: 'All types' },
  { value: 'charity', label: 'Charity' },
  { value: 'ssa', label: 'Social Service Agency' },
  { value: 'vwo', label: 'Voluntary Welfare Org' },
  { value: 'government', label: 'Government Agency' },
  { value: 'foundation', label: 'Foundation' },
];

const CATEGORIES = [
  { value: '', label: 'All categories' },
  { value: 'eldercare', label: 'Eldercare' },
  { value: 'disability', label: 'Disability' },
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'family', label: 'Family Services' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'palliative', label: 'Palliative Care' },
  { value: 'community', label: 'Community' },
  { value: 'children', label: 'Children & Youth' },
  { value: 'financial', label: 'Financial Assistance' },
];

const TYPE_COLORS: Record<string, string> = {
  charity: 'bg-blue-100 text-blue-800',
  ssa: 'bg-teal-100 text-teal-800',
  vwo: 'bg-purple-100 text-purple-800',
  government: 'bg-amber-100 text-amber-800',
  foundation: 'bg-rose-100 text-rose-800',
};

const CATEGORY_COLORS: Record<string, string> = {
  eldercare: 'bg-blue-50 text-blue-700',
  disability: 'bg-purple-50 text-purple-700',
  mental_health: 'bg-green-50 text-green-700',
  family: 'bg-amber-50 text-amber-700',
  healthcare: 'bg-rose-50 text-rose-700',
  palliative: 'bg-indigo-50 text-indigo-700',
  community: 'bg-sky-50 text-sky-700',
  children: 'bg-orange-50 text-orange-700',
  financial: 'bg-emerald-50 text-emerald-700',
};

function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function OrgCard({ org }: { org: Organisation }) {
  const typeColor = TYPE_COLORS[org.type] || 'bg-slate-100 text-slate-800';
  const feedbackSubject = encodeURIComponent(`Incorrect details: ${org.name}`);
  const feedbackBody = encodeURIComponent(
    `Organisation: ${org.name}\nCurrent details on file:\n\nPlease describe what is incorrect:\n`
  );
  const mailtoHref = `mailto:admin@sgassist.sg?subject=${feedbackSubject}&body=${feedbackBody}`;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-slate-900 leading-snug">{org.name}</h3>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded flex-shrink-0 ${typeColor}`}>
          {org.type.toUpperCase()}
        </span>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed mb-3">{org.description}</p>

      {/* Categories */}
      {org.categories.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {org.categories.map(cat => (
            <span
              key={cat}
              className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[cat] || 'bg-slate-50 text-slate-600'}`}
            >
              {formatCategory(cat)}
            </span>
          ))}
        </div>
      )}

      {/* Contact details */}
      <div className="space-y-1.5 text-xs text-slate-500">
        {org.address && (
          <div className="flex items-start gap-1.5">
            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>{org.address}{org.postalCode ? `, ${org.postalCode}` : ''}</span>
          </div>
        )}
        {org.phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3 flex-shrink-0" />
            <a href={`tel:${org.phone}`} className="hover:text-teal-600">{org.phone}</a>
          </div>
        )}
        {org.email && (
          <div className="flex items-center gap-1.5">
            <Mail className="h-3 w-3 flex-shrink-0" />
            <a href={`mailto:${org.email}`} className="hover:text-teal-600">{org.email}</a>
          </div>
        )}
        {org.website && (
          <div className="flex items-center gap-1.5">
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
            <a href={org.website} target="_blank" rel="noopener noreferrer" className="hover:text-teal-600 truncate">
              {org.website.replace(/^https?:\/\//, '')}
            </a>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        {org.registrationNo && (
          <span className="text-[10px] text-slate-400">Reg: {org.registrationNo}</span>
        )}
        <a
          href={mailtoHref}
          className="text-[10px] text-slate-400 hover:text-teal-600 flex items-center gap-1 ml-auto"
        >
          <AlertCircle className="h-3 w-3" />
          Report incorrect details
        </a>
      </div>
    </div>
  );
}

export default function DirectoryPage() {
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // reset to first page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, categoryFilter]);

  const fetchOrganisations = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (typeFilter) params.set('type', typeFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      params.set('page', String(page));
      params.set('limit', '20');

      const response = await fetch(`/api/directory?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setOrganisations(data.organisations);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch organisations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, typeFilter, categoryFilter, page]);

  useEffect(() => {
    fetchOrganisations();
  }, [fetchOrganisations]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Organisation Directory</h1>
        <p className="text-slate-600 max-w-2xl">
          Browse Singapore&apos;s charities, social service agencies, and caregiving organisations.
          Search by name, service type, or describe what you need help with.
        </p>
      </div>

      {/* Search and filters */}
      <div className="mb-6 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or describe what you need help with..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm border border-slate-300 rounded px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {ORG_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-sm border border-slate-300 rounded px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {(typeFilter || categoryFilter || debouncedSearch) && (
            <button
              onClick={() => { setTypeFilter(''); setCategoryFilter(''); setSearchQuery(''); }}
              className="text-xs text-teal-600 hover:text-teal-800 px-2 py-1.5"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      {pagination && (
        <p className="text-xs text-slate-400 mb-4">
          {pagination.total === 0
            ? 'No organisations found'
            : `Showing ${((page - 1) * pagination.limit) + 1}–${Math.min(page * pagination.limit, pagination.total)} of ${pagination.total} organisations`
          }
        </p>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full" />
          <span className="ml-3 text-sm text-slate-500">Loading organisations...</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && organisations.length === 0 && (
        <div className="text-center py-12">
          <Search className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No organisations found</p>
          <p className="text-sm text-slate-400 mt-1">
            {debouncedSearch || typeFilter || categoryFilter
              ? 'Try adjusting your search or filters.'
              : 'The directory is being built. Check back soon for a comprehensive listing of Singapore organisations.'
            }
          </p>
        </div>
      )}

      {/* Organisation grid */}
      {!isLoading && organisations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {organisations.map(org => (
            <OrgCard key={org.id} org={org} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </button>
          <span className="text-sm text-slate-500 px-3">
            Page {page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-slate-200 text-center">
        <p className="text-sm text-slate-400">
          Organisation details are regularly updated from public sources.{' '}
          <a
            href="mailto:admin@sgassist.sg"
            className="text-teal-600 hover:underline"
          >
            Contact admin@sgassist.sg for corrections or additions.
          </a>
        </p>
      </div>
    </div>
  );
}
