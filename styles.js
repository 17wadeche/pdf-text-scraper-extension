const defaultStyleWords = [
  {
    style: 'color:orange',
    words: [
      'Death',
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
      'Contact Name',
      'Facility ID',
      'Contact',
      'Account',
      'Surgeon',
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
      'Surgeon',
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
    style: 'color:green',
    words: [
      'Work Order',
      'workorderNumber',
      'Date Completed',
      'CasePart',
      'AFC',
      'Date Completed',
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
    style: 'color:blue',
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
    style: 'color:red',
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
    style: 'color:purple',
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
      'This is a test of the interface details font background color',
      'This is a test of the interface details background color',
      'This is a test of interface details font background color',
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
]

const config = {
  MNAV: { //BU
    styleWords: defaultStyleWords,
    'Cranial and Spinal Technologies': { // OU 
      styleWords: defaultStyleWords,
    },
    'Ear / Nose / Throat': { // OU 
      styleWords: defaultStyleWords,
    }
  },
  MAE: { // BU
    styleWords: defaultStyleWords,
    'Cranial and Spinal Technologies': { //OU
      styleWords: defaultStyleWords,
    }
  },
  PSS: { // BU
    styleWords: [
      {
        style: 'background:yellow',
        words: ['Date']
      }
    ],
    'Cranial and Spinal Technologies': { //OU
      styleWords: defaultStyleWords,
    }
  },
  Xomed: { // BU
    styleWords: [
      {
        style: 'color:orange',
        words: [
          'Subject Code',
          'Damage Code',
          'Cause Code',
          'Object Part Code',
          'Date of Pick Up',
          'Email',
          'E-mail',
          'email',
          'e-mail',
          'To the following address',
          'Complaint Source',
          'What symptoms were observed / why is service being requested?'
        ]
      },
      {
        style: 'color:blue',
        words: ['Attachment Received']
      },
      {
        style: 'color:red',
        words: [
          'Subject Code',
          'Damage Code',
          'Cause Code',
          'Object Part Code',
          'Date of Pick Up',
          'Email',
          'E-mail',
          'email',
          'e-mail',
          'To the following address',
          'Complaint Source',
          'What symptoms were observed / why is service being requested?',
          'EMAIL',
          'E-MAIL'
        ]
      },
      {
        style: 'color:purple',
        words: [
          'Contact',
          'contact',
          'Facility ID',
          'facility ID',
          'Account',
          'account',
          'Surgeon',
          'surgeon',
          'Initial Reporter',
          'initial reporter',
          'Initial reporter',
          'Physician',
          'physician'
        ]
      },
      {
        style: 'background:yellow',
        words: [
          'Heat',
          'heat',
          'Hot',
          'hot',
          'Heated',
          'heated',
          'Broke',
          'broke',
          'Break',
          'break',
          'Fragments',
          'fragments',
          'Methodology',
          'Death',
          'death',
          'Injury',
          'injury',
          'HOT',
          'HEAT',
          'warm',
          'WARM',
          'Warm',
          'BROKE',
          'BREAK',
          'FRAGMENT',
          'DEATH',
          'INJURY',
          'Notify',
          'NOTIFY',
          'notify',
          'Notified',
          'NOTIFIED',
          'notified',
          'Aware',
          'AWARE',
          'aware',
          'Correct',
          'CORRECT',
          'correct',
          'Deletion flag is set for the notification'
        ]
      }
    ],
    'Cranial and Spinal Technologies': { // OU
      styleWords: defaultStyleWords,
    }
  },
  CRDM: {
    styleWords: [
      {
        style: 'background:yellow',  
        words: ['MRI']
      },
      {
        style: 'color:red',           
        words: ['motor stall']
      }
    ],
    'Cardiac Rhythm Management': {
      styleWords: [
        {
          style: 'background:yellow',
          words: ['infection']
        },
        {
          style: 'color:red',      
          words: ['explant']
        }
      ]
    },
    'Cardiovascular Diagnostics & Services': { // OU
      styleWords: defaultStyleWords,
    },
    'Mechanical Circulatory Support': { // OU
      styleWords: defaultStyleWords,
    }
  },
  Cryocath: { // BU
    'Cardiac Ablation Solutions': { // OU
      styleWords: defaultStyleWords,
    }
  },
  'CV-GALWAY': { // BU
    'Coronary & Renal Denervation': { // OU
      styleWords: defaultStyleWords,
    },
    'Peripheral Vascular Health': { // OU
      styleWords: defaultStyleWords,
    }
  },
  'CV-SH': { // BU
    'Cardiac Surgery': { // OU
      styleWords: defaultStyleWords,
    },
    'Structural Heart and Aortic': { // OU
      styleWords: defaultStyleWords,
    }
  },
  'CV-SR': { // BU
    'Structural Heart and Aortic': { // OU
      styleWords: defaultStyleWords,
    }
  },
  MITG: { // BU
    styleWords: defaultStyleWords,
    'Acute Care & Monitoring': { // OU
      styleWords: defaultStyleWords,
    },
    Endoscopy: { // OU
      styleWords: defaultStyleWords,
    },
    Gastrointestinal: { // OU
      styleWords: defaultStyleWords,
    },
    'Patient Monitoring': { // OU
      styleWords: defaultStyleWords,
    },
    'Pelvic Health': { // OU
      styleWords: defaultStyleWords,
    },
    'Renal Care Solutions': { // OU
      styleWords: defaultStyleWords,
    },
    'Respiratory Interventions': { // OU
      styleWords: defaultStyleWords,
    },
    Surgical: { // OU
      styleWords: defaultStyleWords,
    },
    'Surgical Innovations': { // OU
      styleWords: defaultStyleWords,
    },
    'Surgical Robotics': { // OU
      styleWords: defaultStyleWords,
    }
  },
  NEUROMOD: { // BU
    styleWords: [
      {
        style: 'color:red',
        words: [
          'This is a test of the interface details font color',
          'Text Color Outcome:',
          'This is a test of the interface update details font color',
          'This is a test of the as reported event description font color'
        ]
      },
      {
        style: 'background:yellow',
        words: [
          'Highlighted Text Name:',
          'This is a test of the interface details font background color',
          'This is a test of interface details font background color',
          'This is a test of the interface update details font background color',
          'This is a test of interface update details font background color',
          'This is a test of the as reported event description font background color',
          'This is a test of the interface details font background color',
          'This is a test of the interface details background color',
          'This is a test of interface details font background color',
        ]
      }
    ],
    Neuromodulation: { // OU
      styleWords: [
        {
          style: 'color:red',
          words: ['OU test']
        }
      ]
    }
  },
  NeuroSurgery: { // BU
    styleWords: defaultStyleWords,
    'Cranial and Spinal Technologies': { // OU
      styleWords: defaultStyleWords,
    }
  },
  NV: { // BU
    styleWords: defaultStyleWords,
    Neurovascular: { // OU
      styleWords: defaultStyleWords,
    }
  },
  Spinal: { // BU
    styleWords: defaultStyleWords,
    'Cranial and Spinal Technologies': { // OU
      styleWords: defaultStyleWords,
    }
  },
};

export { defaultStyleWords, config };