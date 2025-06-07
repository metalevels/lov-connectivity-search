import React, { useState } from 'react';
import { Search, Network, GitBranch, Database, ExternalLink, Loader, Award, Info } from 'lucide-react';

// LOV API endpoints
const LOV_SEARCH_API = 'https://lov.linkeddata.es/dataset/lov/api/v2/vocabulary/search';
const LOV_SPARQL_ENDPOINT = 'https://lov.linkeddata.es/dataset/lov/sparql';

// Evidence-based connectivity scoring
const calculateConnectivityScore = (vocab) => {
  const designReuse = parseInt(vocab.reusedByVocabularies) || 0;
  const designFoundation = vocab.dependencies?.length || 0;
  const adoptionReach = parseInt(vocab.reusedByDatasets) || 0;
  const adoptionIntensity = parseInt(vocab.occurrencesInDatasets) || 0;
  
  // Design Convergence (70% total weight)
  const designConvergence = (
    0.5 * Math.log(1 + designReuse) +           // 50% - Expert validation
    0.2 * Math.log(1 + designFoundation)       // 20% - Foundation quality
  );

  // Adoption Convergence (20% total weight)
  const adoptionConvergence = (
    0.15 * Math.log(1 + adoptionReach) +        // 15% - Dataset adoption
    0.05 * Math.log(1 + adoptionIntensity / 1000) // 5% - Usage intensity
  );

  const totalScore = designConvergence + adoptionConvergence;
  return Math.min(1, totalScore / 8);
};

// SPARQL query execution
const executeSPARQLQuery = async (query) => {
  const url = `${LOV_SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/sparql-results+json' }
    });

    if (!response.ok) throw new Error(`SPARQL failed: ${response.status}`);
    const data = await response.json();
    return data.results.bindings;
  } catch (error) {
    console.error('SPARQL error:', error);
    return [];
  }
};

// Get connectivity data for vocabularies
const getConnectivityData = async (vocabularyUris) => {
  if (!vocabularyUris.length) return {};

  const uriFilter = vocabularyUris.map(uri => `<${uri}>`).join(' ');
  const query = `
    PREFIX voaf: <http://purl.org/vocommons/voaf#>
    SELECT ?vocab ?reusedByVocabs ?reusedByDatasets ?occurrences
    WHERE {
      VALUES ?vocab { ${uriFilter} }
      ?vocab a voaf:Vocabulary .
      OPTIONAL { ?vocab voaf:reusedByVocabularies ?reusedByVocabs }
      OPTIONAL { ?vocab voaf:reusedByDatasets ?reusedByDatasets }
      OPTIONAL { ?vocab voaf:occurrencesInDatasets ?occurrences }
    }
  `;

  const results = await executeSPARQLQuery(query);
  const connectivityMap = {};

  results.forEach(result => {
    const uri = result.vocab?.value;
    if (uri) {
      connectivityMap[uri] = {
        reusedByVocabularies: result.reusedByVocabs?.value || '0',
        reusedByDatasets: result.reusedByDatasets?.value || '0',
        occurrencesInDatasets: result.occurrences?.value || '0'
      };
    }
  });

  return connectivityMap;
};

// Get dependency counts
const getDependencyData = async (vocabularyUris) => {
  if (!vocabularyUris.length) return {};

  const uriFilter = vocabularyUris.map(uri => `<${uri}>`).join(' ');
  const query = `
    PREFIX voaf: <http://purl.org/vocommons/voaf#>
    SELECT ?vocab (COUNT(?dependency) as ?depCount)
    WHERE {
      VALUES ?vocab { ${uriFilter} }
      OPTIONAL { ?vocab voaf:reliesOn ?dependency }
    }
    GROUP BY ?vocab
  `;

  const results = await executeSPARQLQuery(query);
  const dependencyMap = {};

  results.forEach(result => {
    const uri = result.vocab?.value;
    if (uri) {
      dependencyMap[uri] = {
        dependencies: Array(parseInt(result.depCount?.value || '0')).fill(null)
      };
    }
  });

  return dependencyMap;
};

// Search LOV API
const searchLOV = async (searchTerm) => {
  if (!searchTerm.trim()) return [];

  try {
    const response = await fetch(`${LOV_SEARCH_API}?q=${encodeURIComponent(searchTerm)}`);
    if (!response.ok) throw new Error(`LOV search failed: ${response.status}`);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('LOV search error:', error);
    return [];
  }
};

// UI Components
const ConnectivityMeter = ({ score }) => {
  const width = Math.round(score * 100);
  const getColor = (score) => {
    if (score >= 0.7) return 'bg-green-500';
    if (score >= 0.4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full ${getColor(score)}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-sm font-medium">{(score * 100).toFixed(0)}%</span>
    </div>
  );
};

const VocabularyCard = ({ vocab, rank }) => {
  const score = calculateConnectivityScore(vocab);
  const title = vocab.title || vocab['http://purl.org/dc/terms/title']?.[0]?.value || 'Untitled';
  const description = vocab.description || vocab['http://purl.org/dc/terms/description']?.[0]?.value || 'No description';

  return (
    <div className="bg-white rounded-lg border shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-sm font-medium">
              #{rank}
            </span>
            <h3 className="text-lg font-semibold text-blue-600">{title}</h3>
            {vocab.homepage && (
              <a href={vocab.homepage} target="_blank" rel="noopener noreferrer" 
                 className="text-gray-400 hover:text-blue-600">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <GitBranch className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium">Vocab Reuses</span>
          </div>
          <span className="text-lg font-bold text-green-600">
            {vocab.reusedByVocabularies || 0}
          </span>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium">Dataset Uses</span>
          </div>
          <span className="text-lg font-bold text-blue-600">
            {vocab.reusedByDatasets || 0}
          </span>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Network className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium">Dependencies</span>
          </div>
          <span className="text-lg font-bold text-purple-600">
            {vocab.dependencies?.length || 0}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Award className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-medium">Connectivity Score</span>
        </div>
        <ConnectivityMeter score={score} />
      </div>

      <div className="text-sm">
        <span className="font-medium text-gray-700">Namespace: </span>
        <code className="text-xs bg-gray-100 px-1 py-0.5 rounded break-all">
          {vocab.uri || 'N/A'}
        </code>
      </div>
    </div>
  );
};

// Main App Component
export default function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState(null);

  const performSearch = async (term) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Search LOV
      const lovResults = await searchLOV(term);
      
      if (lovResults.length === 0) {
        setSearchResults([]);
        setLoading(false);
        return;
      }

      // Step 2: Get connectivity data
      const vocabularyUris = lovResults.map(result => result.uri).filter(Boolean);
      const [connectivityData, dependencyData] = await Promise.all([
        getConnectivityData(vocabularyUris),
        getDependencyData(vocabularyUris)
      ]);

      // Step 3: Merge and rank
      const enhancedResults = lovResults.map(result => ({
        ...result,
        ...connectivityData[result.uri],
        ...dependencyData[result.uri]
      }));

      // Sort by connectivity score
      enhancedResults.sort((a, b) => calculateConnectivityScore(b) - calculateConnectivityScore(a));
      
      setSearchResults(enhancedResults);

    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            LOV Connectivity Search
          </h1>
          <p className="text-gray-600">
            Search LOV vocabularies ranked by connectivity evidence for better interoperability
          </p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg border shadow-sm p-6 mb-8">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search vocabularies (e.g., metadata, person, organization)..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && performSearch(searchTerm)}
              />
            </div>
            <button
              onClick={() => performSearch(searchTerm)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              {loading ? <Loader className="w-5 h-5 animate-spin" /> : 'Search'}
            </button>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Evidence-Based Ranking</p>
                <p>
                  Results ranked by <strong>Design Convergence</strong> (70% - how many vocabulary experts reference this) 
                  and <strong>Adoption Convergence</strong> (20% - real-world usage). 
                  Higher scores indicate better interoperability potential.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="text-red-800">{error}</div>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <Loader className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
            <p className="text-gray-600">Searching and calculating connectivity scores...</p>
          </div>
        )}

        {searchResults.length > 0 && !loading && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">
              Search Results ({searchResults.length} found)
            </h2>
            <div className="grid grid-cols-1 gap-6">
              {searchResults.map((vocab, idx) => (
                <VocabularyCard key={vocab.uri || idx} vocab={vocab} rank={idx + 1} />
              ))}
            </div>
          </div>
        )}

        {searchResults.length === 0 && !loading && searchTerm && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-500">Try different search terms</p>
          </div>
        )}

        {!searchTerm && !loading && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Search LOV Vocabularies</h3>
            <p className="text-gray-500 mb-4">
              Enter a search term to find vocabularies ranked by connectivity evidence
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['metadata', 'person', 'organization', 'location', 'time'].map(term => (
                <button
                  key={term}
                  onClick={() => { setSearchTerm(term); performSearch(term); }}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
