import { useState, useEffect } from 'react';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSR2x4kZurVkW4fVtQROHlRMB7v7i2osvf2-zazRo2RmluGi_7Y0mA46sAT85t5x_vd20ctEtKjtcJa/pub?gid=208474053&single=true&output=csv';

export interface CourseRecord {
  colaborador: string;
  unidad: string;
  area: string;
  funcion: string;
  icf: number;
  rutaAprendizaje: string;
  score: number | null;
  estado: string;
  fase: string;
}

export interface ColaboradorRecord {
  colaborador: string;
  unidad: string;
  area: string;
  funcion: string;
  icf: number;
}

export function useFormacionData() {
  const [data, setData] = useState<CourseRecord[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(CSV_URL);
        const text = await response.text();
        
        // Basic CSV parser that handles quotes
        const parseCSVRow = (row: string) => {
          const result = [];
          let insideQuotes = false;
          let currentEntry = '';
          for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
              result.push(currentEntry);
              currentEntry = '';
            } else {
              currentEntry += char;
            }
          }
          result.push(currentEntry);
          return result;
        };

        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        // Find row 5 for course names (0-indexed -> 4)
        const row5 = parseCSVRow(lines[4]);
        const courseNames = row5.slice(6); // first 6 are empty or other things
        
        const records: CourseRecord[] = [];
        const colabMap = new Map<string, ColaboradorRecord>();

        // Data starts at row 9 (0-indexed -> 8)
        for (let i = 8; i < lines.length; i++) {
          const row = parseCSVRow(lines[i]);
          if (row.length < 6) continue;
          
          const unidad = row[0] || '';
          const colaborador = row[1] || '';
          const area = row[2] || '';
          const funcion = row[3] || '';
          // row[4] is categoria
          const rawIcf = row[5] || '0';
          const icf = parseFloat(rawIcf.replace(',', '.')) || 0;

          if (colaborador) {
            colabMap.set(colaborador, { colaborador, unidad, area, funcion, icf });
          }

          // Read course scores
          for (let j = 6; j < row.length; j++) {
            const courseName = courseNames[j - 6];
            if (!courseName) continue;
            
            const rawScore = row[j];
            let score: number | null = null;
            let estado = 'Pendiente';
            let fase = '';

            if (rawScore && rawScore.trim() !== '') {
              score = parseFloat(rawScore.replace(',', '.'));
              if (!isNaN(score)) {
                estado = score >= 70 ? 'Aprobado' : 'Desaprobado';
              } else {
                score = null;
              }
            }

            if (courseName.toLowerCase().includes('certificaci')) {
              fase = 'Certificación';
            }

            records.push({
              colaborador,
              unidad,
              area,
              funcion,
              icf,
              rutaAprendizaje: courseName,
              score,
              estado,
              fase
            });
          }
        }

        setData(records);
        setColaboradores(Array.from(colabMap.values()));
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError('Error loading data');
        setLoading(false);
      }
    }
    load();
  }, []);

  return { data, colaboradores, loading, error };
}
