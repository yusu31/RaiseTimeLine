// CloudFront Function(viewer-request): 画面側のビヘイビア(既定)にだけ付ける。
// SPA(React Router)の画面のURL(/posts/1 など)はS3に実ファイルが無いので、/index.html に書き換えて返す。
// 拡張子のあるパス(/assets/app-xxx.js など)は実ファイルなのでそのまま通す。
// /api/* は別のビヘイビアなので、この関数は通らない(APIの404がHTMLに化けない)。
function handler(event) {
  var request = event.request;
  var lastSegment = request.uri.split('/').pop();

  // 最後の区切りに「.」が無い(=ファイル名ではない)パスを画面のURLとみなす
  if (lastSegment.indexOf('.') === -1) {
    request.uri = '/index.html';
  }
  return request;
}
