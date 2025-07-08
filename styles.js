// styles.js

const defaultStyleWords = [
  {
    style: 'font-weight:bold',
    words: [
      'HOSPITALIZATION',
      'RESULT',
      'Work Order',
      'This is a test of the interface details font weight',
      'Text Weight Result:',
      'This is a test of the interface details font weight',
      'This is a test of the interface update details font weight',
      'This is a test of the as reported event description font weight',
      'CasePart-',
      'workorderNumber',
      'AFC',
      'Contact Name',
      'Facility ID',
      'Contact',
      'Account',
      'Surgeon',
      'When Issue Occurred',
      'Length of Extended Surgical Time',
      'What Software Task When Issue Occurred',
      'EventSummary',
      'lengthOfExternalSurgicalTime',
      'Next Action/Resolution',
      'Description',
      'Was Medtronic Imaging Aborted',
      'Surgery Aborted',
      'Was Navigation Aborted',
      'Type of Surgical Procedure',
      'Was a Patient Involved',
      'Patient Id',
      'Patient Gender',
      'Patient Age Units',
      'Patient Weight',
      'Patient Weight Units',
      'Patient Date of Birth',
      'PEI',
      'MNAV Comment ID:',
      'MNAV Comment Subject:',
      'MNAV Comment:',
      'MNAV Created By:',
      'MNAV Created Date:',
      'MNAV Case Part:',
      'Date Completed',
      'Action/Resolution',
      'Event confirmed?',
      'Symptom',
      'Most Probable Cause',
      'Probable Cause',
      'Resolution',
      'Verification',
      'System Status',
      'Mechanical Inspection',
      'Mechanical Inspection Failure',
      'Mechanical Inspection Summary of Failure(s)',
      'Does the System Perform as Intended?',
      'Imaging Modalities Failure',
      'Imaging Summary of Failure(s)',
      'Imaging Modalities',
      'Failure Mode',
      'Able To Duplicate The Issue',
      'Findings and Conclusions',
      'Failure Mechanism',
      'Methodology',
      'Tested By Date',
      'Lot #',
      'Cause Code Description',
      'Cause Code',
      'Cause Code Text',
      'Date Received Back',
      'Next Action',
      'Action',
      'Possession',
      'Logs and Archive Uploaded',
      'Software Version',
      'No Return Justification',
      'Finding & conclusions',
      'Resolution confirmed on call',
      'Were hardware parts replaced?',
      'Finding & Conclusions',
      'Returned Unused',
      'Initial Reporter',
      'General Summary of Failure(s)',
      'Is General Failure Resolved?',
      'Hardware Failure',
      'Return Item Status'
    ]
  },
  {
    style: 'color:transparent; text-shadow: green 0px 0px 1px !important',
    words: [
      'Work Order',
      'workorderNumber',
      'Date Completed',
      'CasePart',
      'AFC',
      'Does the System Perform as Intended?',
      'Imaging Modalities Failure',
      'Imaging Summary of Failure(s)',
      'Imaging Modalities',
      'Lot #',
      'Were hardware parts replaced?',
      'Returned Unused',
      'Mechanical Inspection',
      'Mechanical Inspection Failure',
      'Mechanical Inspection Summary of Failure(s)'
    ]
  },
  {
    style: 'color:transparent; text-shadow: blue 0px 0px 1px !important',
    words: [
      'When Issue Occurred',
      'Length of Extended Surgical Time',
      'What Software Task',
      'EventSummary',
      'lengthOfExternalSurgicalTime',
      'Next Action/Resolution',
      'Next Action',
      'Description',
      'Possession',
      'No Return Justification',
      'Software Version',
      'Date Received Back',
      'Logs and Archive Uploaded',
      'PASS',
      'YES',
      'Return Item Status'
    ]
  },
  {
    style: 'color:transparent; text-shadow: red 0px 0px 1px !important',
    words: [
      'Was Medtronic Imaging Aborted',
      'This is a test of the interface details font color',
      'This is a test of the interface details font color',
      'Text Color Outcome:',
      'This is a test of the interface update details font color',
      'This is a test of the as reported event description font color',
      'Surgery Aborted',
      'Was Navigation Aborted',
      'Type of Surgical Procedure',
      'Was a Patient Involved',
      'Patient Id',
      'Patient Gender',
      'Patient Age Units',
      'Patient Weight',
      'Patient Weight Units',
      'Patient Date of Birth',
      'PEI',
      'MNAV Created Date:',
      'FAIL'
    ]
  },
  {
    style: 'color:transparent; text-shadow: purple 0px 0px 1px !important',
    words: [
      'Contact Name',
      'Facility ID',
      'Contact',
      'Account',
      'Surgeon',
      'Initial Reporter'
    ]
  },
  {
    style: 'background:white',
    words: ['AFC', 'Lot #']
  },
  {
    style: 'background:yellow',
    words: [
      'Action/Resolution',
      'Highlighted Text Name:',
      'This is a test of the interface details font background color',
      'This is a test of interface details font background color',
      'This is a test of the interface update details font background color',
      'This is a test of interface update details font background color',
      'This is a test of the as reported event description font background color',
      'This is a test of the interface details background color',
      'Event confirmed?',
      'Symptom',
      'Most Probable Cause',
      'Most probable Cause',
      'Resolution',
      'Verification',
      'System Status',
      'Failure Mode',
      'Able To Duplicate The Issue',
      'Findings and Conclusions',
      'Failure Mechanism',
      'Methodology',
      'Tested By Date',
      'Cause Code Description',
      'Cause Code',
      'Cause Code Text',
      'Probable Cause',
      'Next Action',
      'Action',
      'Resolution confirmed on call',
      'General Summary of Failure(s)',
      'Is General Failure Resolved?',
      'Finding & Conclusions',
      'Hardware Failure',
      'WEBMREMOTEWS'
    ]
  }
];

const config = {
  MNAV: {
    styleWords: defaultStyleWords,
    'Cranial and Spinal Technologies': { styleWords: defaultStyleWords },
    'Ear / Nose / Throat':           { styleWords: defaultStyleWords }
  },
  MAE: {
    styleWords: defaultStyleWords,
    'Cranial and Spinal Technologies': { styleWords: defaultStyleWords }
  },
  PSS: {
    styleWords: [
      { style: 'background:yellow', words: ['Date'] }
    ],
    'Cranial and Spinal Technologies': { styleWords: defaultStyleWords }
  },
  Xomed: {
    styleWords: [
      { style: 'font-weight:bold',
        words: [
          'Subject Code','Damage Code','Cause Code','Object Part Code',
          'Date of Pick Up','Email','E-mail','email','e-mail',
          'To the following address','Complaint Source',
          'What symptoms were observed / why is service being requested?'
        ]
      },
      { style: 'color:transparent; text-shadow: blue 0px 0px 1px !important',
        words: ['Attachment Received'] },
      { style: 'color:transparent; text-shadow: red  0px 0px 1px !important',
        words: [
          'Subject Code','Damage Code','Cause Code','Object Part Code',
          'Date of Pick Up','Email','E-mail','email','e-mail',
          'To the following address','Complaint Source',
          'What symptoms were observed / why is service being requested?',
          'EMAIL','E-MAIL'
        ]
      },
      { style: 'color:transparent; text-shadow: purple 0px 0px 1px !important',
        words: [
          'Contact','contact','Facility ID','facility ID',
          'Account','account','Surgeon','surgeon',
          'Initial Reporter','initial reporter','Initial reporter',
          'Physician','physician'
        ]
      },
      { style: 'background:yellow',
        words: [
          'Heat','heat','Hot','hot','Heated','heated','Broke','broke',
          'Break','break','Fragments','fragments','Methodology','Death',
          'death','Injury','injury','HOT','HEAT','warm','WARM','Warm',
          'BROKE','BREAK','FRAGMENT','DEATH','INJURY','Notify','NOTIFY',
          'notify','Notified','NOTIFIED','notified','Aware','AWARE','aware',
          'Correct','CORRECT','correct','Deletion flag is set for the notification'
        ]
      }
    ],
    'Cranial and Spinal Technologies': { styleWords: defaultStyleWords }
  },
  CRDM: {
    styleWords: [
      { style: 'background:yellow', words: ['MRI'] },
      { style: 'color:transparent; text-shadow: red 0px 0px 1px !important', words: ['motor stall'] },
      { style: 'font-weight:bold', words: ['recovery'] }
    ],
    'Cardiac Rhythm Management': {
      styleWords: [
        { style: 'background:yellow', words: ['infection'] },
        { style: 'font-weight:bold',  words: ['erosion'] },
        { style: 'color:transparent; text-shadow: red 0px 0px 1px !important', words: ['explant'] }
      ]
    },
    'Cardiovascular Diagnostics & Services': { styleWords: defaultStyleWords },
    'Mechanical Circulatory Support':         { styleWords: defaultStyleWords }
  },
  Cryocath: { 'Cardiac Ablation Solutions': { styleWords: defaultStyleWords } },
  'CV-GALWAY': {
    'Coronary & Renal Denervation':    { styleWords: defaultStyleWords },
    'Peripheral Vascular Health':      { styleWords: defaultStyleWords }
  },
  'CV-SH': {
    'Cardiac Surgery':                 { styleWords: defaultStyleWords },
    'Structural Heart and Aortic':     { styleWords: defaultStyleWords }
  },
  'CV-SR': { 'Structural Heart and Aortic': { styleWords: defaultStyleWords } },
  MITG: {
    styleWords: defaultStyleWords,
    'Acute Care & Monitoring':         { styleWords: defaultStyleWords },
    Endoscopy:                         { styleWords: defaultStyleWords },
    Gastrointestinal:                  { styleWords: defaultStyleWords },
    'Patient Monitoring':              { styleWords: defaultStyleWords },
    'Pelvic Health':                   { styleWords: defaultStyleWords },
    'Renal Care Solutions':            { styleWords: defaultStyleWords },
    'Respiratory Interventions':       { styleWords: defaultStyleWords },
    Surgical:                          { styleWords: defaultStyleWords },
    'Surgical Innovations':            { styleWords: defaultStyleWords },
    'Surgical Robotics':               { styleWords: defaultStyleWords }
  },
  NEUROMOD: {
    styleWords: [
      { style: 'color:transparent; text-shadow: red 0px 0px 1px !important',
        words: [
          'This is a test of the interface details font color',
          'Text Color Outcome:',
          'This is a test of the interface update details font color',
          'This is a test of the as reported event description font color'
        ]
      },
      { style: 'font-weight:bold',
        words: [
          'This is a test of the interface details font weight',
          'Text Weight Result:',
          'This is a test of the interface update details font weight',
          'This is a test of the as reported event description font weight',
          'BU test'
        ]
      },
      { style: 'background:yellow',
        words: [
          'Highlighted Text Name:',
          'This is a test of the interface details font background color',
          'This is a test of interface details font background color',
          'This is a test of the interface update details font background color',
          'This is a test of interface update details font background color',
          'This is a test of the as reported event description font background color',
          'This is a test of the interface details background color'
        ]
      }
    ],
    Neuromodulation: {
      styleWords: [
        { style: 'color:transparent; text-shadow: red 0px 0px 1px !important', words: ['OU test'] }
      ]
    }
  },
  NeuroSurgery:          { styleWords: defaultStyleWords, 'Cranial and Spinal Technologies': { styleWords: defaultStyleWords } },
  NV:                     { styleWords: defaultStyleWords, Neurovascular: { styleWords: defaultStyleWords } },
  Spinal: { styleWords: defaultStyleWords, 'Cranial and Spinal Technologies': { styleWords: defaultStyleWords } }
};

export { defaultStyleWords, config };
