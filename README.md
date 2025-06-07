# LOV Connectivity Search

A simple web application that searches the Linked Open Vocabularies (LOV) and ranks results by connectivity-based evidence for better semantic interoperability.

## 🚀 Quick Start

**One command to run:**

```bash
npm install && npm start
```

That's it! The app will open in your browser at `http://localhost:4000`

## 📖 What It Does

1. **Search LOV**: Enter any term (like "metadata", "person", "organization")
2. **Get Real Data**: Fetches live data from LOV's search API and SPARQL endpoint
3. **Rank by Connectivity**: Uses evidence-based scoring that prioritizes:
   - **Design Convergence (70%)**: How many vocabulary experts reference this vocabulary
   - **Adoption Convergence (20%)**: Real-world usage in datasets
4. **Show Evidence**: Displays why each vocabulary scored high/low

## 🎯 Key Features

- **Real LOV Integration**: Live data from lov.linkeddata.es
- **Evidence-Based Ranking**: Prioritizes vocabularies that foster interoperability
- **Simple Interface**: Just type and search - no configuration needed
- **Connectivity Scoring**: See vocabulary reuse patterns, dataset adoption, and dependencies
- **Quick Examples**: Click suggested terms to see results immediately

## 🔬 The Science

The connectivity score combines:

- **50%** - Vocabulary Reuses (how many other vocabularies reference this one)
- **20%** - Foundation Quality (how well it builds on established vocabularies)
- **15%** - Dataset Adoption (how many datasets actually use it)
- **5%** - Usage Intensity (total occurrences in data)

This approach surfaces vocabularies that both domain experts and practitioners have validated as useful for integration.

## 📊 Example Results

Search "metadata" and you'll see:
1. **Dublin Core Terms** - High score due to 630+ vocabulary references
2. **Dublin Core Elements** - High adoption across datasets
3. **FOAF** - Strong cross-domain connectivity

## 🛠 Technology

- **React 18** - Simple, modern UI
- **Vite** - Fast development and building
- **Tailwind CSS** - Clean, responsive styling
- **LOV APIs** - Real semantic web data

## 📝 Development

```bash
# Install dependencies
npm install

# Start development server (runs on port 4000)
npm start

# Build for production
npm run build
```

## 🎯 Use Cases

- **Data Architects**: Find vocabularies with proven interoperability
- **Semantic Web Developers**: Discover well-connected vocabularies for projects
- **Standards Bodies**: See which vocabularies have community validation
- **Researchers**: Study vocabulary adoption and reuse patterns

## 🔗 Links

- [Linked Open Vocabularies (LOV)](https://lov.linkeddata.es/)
- [VOAF Vocabulary](http://purl.org/vocommons/voaf)
- [Semantic Interoperability Research](https://github.com/metalevels/lov-connectivity-search)

---

**Simple goal**: Help you find vocabularies that work well with others! 🌐
