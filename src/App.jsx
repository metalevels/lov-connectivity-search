import React, { useState } from 'react';
import { Search, Network, GitBranch, Database, ExternalLink, Loader, Award, Info, TrendingUp } from 'lucide-react';

// LOV API endpoints
const LOV_SEARCH_API = 'https://lov.linkeddata.es/dataset/lov/api/v2/vocabulary/search';
const LOV_SPARQL_ENDPOINT = 'https://lov.linkeddata.es/dataset/lov/sparql';

// Updated connectivity scoring with design and adoption convergence
const calculateConnectivityScore = (adoptionData, designData) => {
  // Adoption Convergence (Evidence of actual instantiation)
  const reusedByVocabs = parseInt(adoptionData.reusedByVocabularies) || 0;
  const reusedByDatasets = parseInt(adoptionData.reusedByDatasets) || 0;
  const occurrences = parseInt(adoptionData.occurrencesInDatasets) || 0;
  
  // Design Convergence (Vocab-to-vocab connections)
  const extendsCount = designData['extends'] || 0;
  const hasEquivalences = designData.hasEquivalencesWith || 0;
  const reliesOn = designData.reliesOn || 0;
  const usedBy = designData.usedBy || 0;
  const specializes = designData.specializes || 0;
  const generalizes = designData.generalizes || 0;
  
  // Design Convergence Score - higher cardinality = more central
  const designConvergence = (
    Math.log(1 + extendsCount) +
    Math.log(1 + hasEquivalences) +
    Math.log(1 + reliesOn) +
    Math.log(1 + usedBy) +
    Math.log(1 + specializes) +
    Math.log(1 + generalizes)
  );
  
  // Adoption Convergence Score - evidence of data points instantiated
  const adoptionConvergence = (
    Math.log(1 + reusedByVocabs) +
    Math.log(1 + reusedByDatasets) +
    Math.log(1 + occurrences / 1000)
  );
  
  // Combine scores (60% design convergence, 40% adoption convergence)
  const totalScore = (0.6 * designConvergence) + (0.4 * adoptionConvergence);
  return Math.min(1, totalScore / 15); // Normalize to 0-1
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

// Get adoption convergence data for vocabularies
const getAdoptionConvergenceData = async (vocabularyUris) => {
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
  const adoptionMap = {};

  results.forEach(result => {
    const uri = result.vocab?.value;
    if (uri) {
      adoptionMap[uri] = {
        reusedByVocabularies: result.reusedByVocabs?.value || '0',
        reusedByDatasets: result.reusedByDatasets?.value || '0',
        occurrencesInDatasets: result.occurrences?.value || '0'
      };
    }
  });

  return adoptionMap;
};

// Get design convergence data for vocabularies
const getDesignConvergenceData = async (vocabularyUris) => {
  if (!vocabularyUris.length) return {};

  const uriFilter = vocabularyUris.map(uri => `<${uri}>`).join(' ');
  const query = `
    PREFIX voaf: <http://purl.org/vocommons/voaf#>
    
    SELECT ?vocab 
           (COUNT(DISTINCT ?extends) as ?extendsCount)
           (COUNT(DISTINCT ?hasEquiv) as ?hasEquivalencesCount) 
           (COUNT(DISTINCT ?reliesOn) as ?reliesOnCount)
           (COUNT(DISTINCT ?usedBy) as ?usedByCount)
           (COUNT(DISTINCT ?specializes) as ?specializesCount)
           (COUNT(DISTINCT ?generalizes) as ?generalizesCount)
    WHERE {
      VALUES ?vocab { ${uriFilter} }
      ?vocab a voaf:Vocabulary .
      OPTIONAL { ?vocab voaf:extends ?extends }
      OPTIONAL { ?vocab voaf:hasEquivalencesWith ?hasEquiv }
      OPTIONAL { ?vocab voaf:reliesOn ?reliesOn }
      OPTIONAL { ?vocab voaf:usedBy ?usedBy }
      OPTIONAL { ?vocab voaf:specializes ?specializes }
      OPTIONAL { ?vocab voaf:generalizes ?generalizes }
    }
    GROUP BY ?vocab
  `;

  const results = await executeSPARQLQuery(query);
  const designMap = {};

  results.forEach(result => {
    const uri = result.vocab?.value;
    if (uri) {
      designMap[uri] = {
        'extends': parseInt(result.extendsCount?.value || '0'),
        hasEquivalencesWith: parseInt(result.hasEquivalencesCount?.value || '0'),
        reliesOn: parseInt(result.reliesOnCount?.value || '0'),
        usedBy: parseInt(result.usedByCount?.value || '0'),
        specializes: parseInt(result.specializesCount?.value || '0'),
        generalizes: parseInt(result.generalizesCount?.value || '0')
      };
    }
  });

  return designMap;
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
  const score = vocab.connectivityScore;
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

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium">Design Convergence</span>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <div>Extends: {vocab.designData?.['extends'] || 0}</div>
            <div>Equivalences: {vocab.designData?.hasEquivalencesWith || 0}</div>
            <div>Dependencies: {vocab.designData?.reliesOn || 0}</div>
          </div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium">Adoption Convergence</span>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <div>Vocab Reuses: {vocab.adoptionData?.reusedByVocabularies || 0}</div>
            <div>Dataset Uses: {vocab.adoptionData?.reusedByDatasets || 0}</div>
            <div>Occurrences: {parseInt(vocab.adoptionData?.occurrencesInDatasets || 0).toLocaleString()}</div>
          </div>
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
      const [adoptionData, designData] = await Promise.all([
        getAdoptionConvergenceData(vocabularyUris),
        getDesignConvergenceData(vocabularyUris)
      ]);

      // Step 3: Merge data and calculate scores
      const enhancedResults = lovResults.map(result => {
        const adoption = adoptionData[result.uri] || {
          reusedByVocabularies: '0',
          reusedByDatasets: '0',
          occurrencesInDatasets: '0'
        };
        
        const design = designData[result.uri] || {
          'extends': 0, hasEquivalencesWith: 0, reliesOn: 0,
          usedBy: 0, specializes: 0, generalizes: 0
        };
        
        return {
          ...result,
          adoptionData: adoption,
          designData: design,
          connectivityScore: calculateConnectivityScore(adoption, design)
        };
      });

      // Step 4: Sort by connectivity score
      enhancedResults.sort((a, b) => b.connectivityScore - a.connectivityScore);
      
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
            Search LOV vocabularies ranked by design and adoption convergence for better interoperability
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
                <p className="font-medium mb-1">Updated Connectivity-Based Ranking</p>
                <p>
                  Results ranked by <strong>Design Convergence</strong> (60% - vocab-to-vocab connections: extends, equivalences, dependencies) 
                  and <strong>Adoption Convergence</strong> (40% - actual usage evidence). 
                  Higher scores indicate proven interoperability patterns.
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