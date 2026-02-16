import { SearchManager } from './search';
import { MapManager } from './map';

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const mapManager = new MapManager();
  const searchManager = new SearchManager(mapManager);

  console.log('✓ Election Registry App initialized');
});
