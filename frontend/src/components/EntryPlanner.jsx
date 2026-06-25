// frontend/src/components/EntryPlanner.jsx
import React from 'react';
import '../styles/EntryPlanner.css';
import ModelCard from './ModelCard';

const EntryPlanner = ({ formData, models, loading, error, onUpdateManualLots, activeSpec }) => {
  if (loading && !models) {
    return <div className="status-container">Calculating models...</div>;
  }

  if (error) {
    return <div className="status-container error-container">Error: {error}</div>;
  }

  if (!models) {
    return <div className="status-container">No models calculated.</div>;
  }

  return (
    <div className="entry-planner-container">
      <div className="models-grid">
        <ModelCard 
          model={models.equal} 
          formData={formData} 
          activeSpec={activeSpec} 
        />
        <ModelCard 
          model={models.front_loaded} 
          formData={formData} 
          activeSpec={activeSpec} 
        />
        <ModelCard 
          model={models.back_loaded} 
          formData={formData} 
          activeSpec={activeSpec} 
        />
        <ModelCard 
          model={models.manual} 
          formData={formData} 
          activeSpec={activeSpec} 
          isManual={true}
          onUpdateManualLots={onUpdateManualLots}
        />
      </div>
    </div>
  );
};

export default EntryPlanner;