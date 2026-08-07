const hfricatmar = {
  network: {
    "site_code": "HFR-ICATMAR",
    "title": "ICATMAR HF Radar Network",
    "acknowledgement": "ICATMAR HF Radar Network has been established with the support of the European Maritime and Fisheries Fund, the European Maritime, Fisheries and Aquaculture Fund and the fund provided by the Government of Catalonia. The network has been designed, implemented and managed through the efforts of the Direcció General de Política Marítima i Pesca Sostenible (Government of Catalonia) and the Insitut de CiÃ¨ncies del Mar (CSIC), Barcelona.",
    "citation": "These data were collected and made freely available by the EuroGOOS European HFR Node. These data were collected and made freely available by ICATMAR and the programs that contribute to it. Data was collected by the Government of Catalonia and CEFREM (France), and processed by ICATMAR with the support of the European Maritime, Fisheries and Aquaculture Fund (EMFAF) and the Climatic Funds Program of the Government of Catalonia.",
    "comment": "Total velocities are derived using least square fit that maps radial velocities measured from individual sites onto a cartesian grid. The final product is a map of the horizontal components of the ocean currents on a regular grid in the area of overlap of two or more radar stations.",
    "distribution_statement": "These data are public and free of charge. User assumes all risk for use of data. User must display citation in any publication or product using data. User must contact PI prior to any commercial use of data.",
    "license": "HF radar sea surface current velocity dataset by ICATMAR is licensed under a Creative Commons Attribution 4.0 International License. You should have received a copy of the license along with this work. If not, see https://creativecommons.org/licenses/by/4.0/.",
    "summary": "The data set consists of maps of total velocity of the surface current along the Catalan coast averaged over a time interval of 1 hour around the cardinal hour. Surface ocean velocities estimated by High Frequency (HF) Radar are representative of the upper 1.3 meters of the ocean."
  },
  stations: [
    {
      "id": "CNET",
      "name": "Canet-en-Roussillon",
      "latitude": 42.7020167,
      "longitude": 3.0380167,
      "metadata": {
        "doa_estimation_method": "Direction Finding",
        "network": "HFR-ICATMAR",
        "institution": "CEFREM",
        "sensor_model": "CODAR",
        "time_coverage_start": "2026-02-16T12:00:00Z",
        "summary": "The data set consists of maps of radial velocity of the sea water surface current collected at Canet-en-Roussillon French (CNET) site in the Gulf of Lion coast. High Frequency (HF)-RADAR measurements of ocean velocity are radial in direction relative to the radar location and representative of the upper 1.3 meters of the ocean."
        
      }
    },
    {
      "id": "CREU",
      "name": "Cap de Creus",
      "latitude": 42.31905,
      "longitude": 3.31585,
      "metadata": {
        "doa_estimation_method": "Direction Finding",
        "network": "HFR-ICATMAR",
        "institution": "Direcció General de Política Marítima i Pesca Sostenible - Generalitat de Catalunya",
        "sensor_model": "CODAR",
        "time_coverage_start": "2023-02-17T11:00:00Z",
        "summary": "The data set consists of maps of radial velocity of the sea water surface current collected at Cap de Creus (CREU) site in the Catalan coast. High Frequency (HF)-RADAR measurements of ocean velocity are radial in direction relative to the radar location and representative of the upper 1.3 meters of the ocean.",
        "wmo_platform_code": "6103622"
      }
    },
    {
      "id": "BEGU",
      "name": "Begur",
      "latitude": 41.9671667,
      "longitude": 3.2305333,
      "metadata": {
        "doa_estimation_method": "Direction Finding",
        "network": "HFR-ICATMAR",
        "institution": "Direcció General de Política Marítima i Pesca Sostenible - Generalitat de Catalunya",
        "sensor_model": "CODAR",
        "time_coverage_start": "2023-04-04T09:00:00Z",
        "summary": "The data set consists of maps of radial velocity of the sea water surface current collected at Begu (BEGU) site in the Catalan coast. High Frequency (HF)-RADAR measurements of ocean velocity are radial in direction relative to the radar location and representative of the upper 1.3 meters of the ocean.",
        "wmo_platform_code": "6103621"
      }
    },
    {
      "id": "AREN",
      "name": "Arenys de Mar",
      "latitude": 41.5775833,
      "longitude": 2.5577333,
      "metadata": {
        "doa_estimation_method": "Direction Finding",
        "network": "HFR-ICATMAR",
        "institution": "Direcció General de Política Marítima i Pesca Sostenible - Generalitat de Catalunya",
        "sensor_model": "CODAR",
        "time_coverage_start": "2023-11-29T18:00:00Z",
        "summary": "The data set consists of maps of radial velocity of the sea water surface current collected at Arenys (AREN) site in the Catalan coast. High Frequency (HF)-RADAR measurements of ocean velocity are radial in direction relative to the radar location and representative of the upper 1.3 meters of the ocean.",
        "wmo_platform_code": "6103620"
      }
    },
    {
      "id": "TOSS",
      "name": "Tossa de Mar",
      "latitude": 41.7157,
      "longitude": 2.9339,
      "metadata": {
        "doa_estimation_method": "Direction Finding",
        "network": "HFR-ICATMAR",
        "institution": "Direcció General de Política Marítima i Pesca Sostenible - Generalitat de Catalunya",
        "sensor_model": "CODAR",
        "time_coverage_start": "2025-06-06T13:00:00Z",
        "summary": "The data set consists of maps of radial velocity of the sea water surface current collected at Tossa (TOSS) site in the Catalan coast. High Frequency (HF)-RADAR measurements of ocean velocity are radial in direction relative to the radar location and representative of the upper 1.3 meters of the ocean.",
        "wmo_platform_code": "6103674"
      }
    },
    {
      "id": "PBCN",
      "name": "Port de Barcelona",
      "latitude": 41.3475833,
      "longitude": 2.17405,
      "metadata": {
        "doa_estimation_method": "Direction Finding",
        "network": "HFR-ICATMAR",
        "institution": "Direcció General de Política Marítima i Pesca Sostenible - Generalitat de Catalunya",
        "sensor_model": "CODAR",
        "time_coverage_start": "2023-12-05T11:00:00Z",
        "summary": "The data set consists of maps of radial velocity of the sea water surface current collected at the Port de Barcelona (PBCN) site in the Catalan coast. High Frequency (HF)-RADAR measurements of ocean velocity are radial in direction relative to the radar location and representative of the upper 1.3 meters of the ocean.",
        "wmo_platform_code": "6103624"
      }
    },
    {
      "id": "GNST",
      "name": "Port Ginesta",
      "latitude": 41.2560667,
      "longitude": 1.9221833,
      "metadata": {
        "doa_estimation_method": "Direction Finding",
        "network": "HFR-ICATMAR",
        "institution": "Direcció General de Política Marítima i Pesca Sostenible - Generalitat de Catalunya",
        "sensor_model": "CODAR",
        "time_coverage_start": "2023-11-16T11:00:00Z",
        "summary": "The data set consists of maps of radial velocity of the sea water surface current collected at Port Ginesta (GNST) site in the Catalan coast. High Frequency (HF)-RADAR measurements of ocean velocity are radial in direction relative to the radar location and representative of the upper 1.3 meters of the ocean.",
        "wmo_platform_code": "6103623"
      }
    },
    {
      "id": "SCAL",
      "name": "Segur de Calafell",
      "latitude": 41.1862833,
      "longitude": 1.6073,
      "metadata": {
        "doa_estimation_method": "Direction Finding",
        "network": "HFR-ICATMAR",
        "institution": "Direcció General de Política Marítima i Pesca Sostenible - Generalitat de Catalunya",
        "sensor_model": "CODAR",
        "time_coverage_start": "2025-06-06T13:00:00Z",
        "summary": "The data set consists of maps of radial velocity of the sea water surface current collected at Segur de Calafell (SCAL) site in the Catalan coast. High Frequency (HF)-RADAR measurements of ocean velocity are radial in direction relative to the radar location and representative of the upper 1.3 meters of the ocean."
      }
    }
  ]
}


  export default hfricatmar;