// /************************************************************************
//  * Competitor.js
//  ************************************************************************/
// import mongoose from 'mongoose';

// const competitorSchema = new mongoose.Schema(
//   {
//     // e.g. ["cream-deluxe.com", "smartwhip.com", ...]
//     list: {
//       type: [String],
//       required: true,
//     },
//   },
//   { timestamps: true }
// );

// export default mongoose.model('Competitor', competitorSchema);



/************************************************************************
 * Competitor.js
 ************************************************************************/
import mongoose from 'mongoose';

const competitorSchema = new mongoose.Schema(
  {
    // e.g. ["cream-deluxe.com", "smartwhip.com", ...]
    list: {
      type: [String],
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Competitor', competitorSchema);
