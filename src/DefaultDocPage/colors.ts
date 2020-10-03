import chroma from 'chroma-js';


const scale = chroma.scale(['#55aadd', 'hotpink']).colors(5, null);


// TODO: Allow to customize color scale/theme via plugin configuration?
// (Not really important if we will write this file with GHA based on docs configuration)
export default {
  scale,
  link: scale[0].darken(1),
};
