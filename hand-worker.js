// Run inference off the animation thread. Versions for JS and WASM must match.
const CDN='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304';
let landmarker;
self.onmessage=async({data})=>{
  if(data.type==='init'){
    try{
      const {FilesetResolver,HandLandmarker}=await import(`${CDN}/vision_bundle.mjs`);
      const files=await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
      landmarker=await HandLandmarker.createFromOptions(files,{
        baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'CPU'},
        runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.6
      });
      self.postMessage({type:'ready'});
    }catch(error){self.postMessage({type:'error',message:error.message});}
  }
  if(data.type==='frame'){
    try{
      const result=landmarker.detectForVideo(data.frame,data.timestamp);
      self.postMessage({type:'result',points:result.landmarks[0]||null,timestamp:data.timestamp});
    }catch(error){self.postMessage({type:'error',message:error.message});}
    finally{data.frame.close();}
  }
};
